pub mod config;
pub mod crypto;
pub mod installer;
pub mod process;
pub mod state;

use crate::ipfs::process::IpfsChild;
use crate::ipfs::state::{IpfsPaths, IpfsState, IpfsStateSnapshot, IpfsStatus, SharedIpfsState};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

pub struct IpfsManager {
    pub state: SharedIpfsState,
    pub paths: IpfsPaths,
    /// Держится синхронно; kill в обработчике выхода не требует tokio-рантайма.
    pub child: StdMutex<Option<IpfsChild>>,
    /// Сериализует ensure/stop/update/uninstall: параллельные клики не поднимают
    /// два демона на один repo, а update во время распаковки не сносит bin_dir
    /// из-под ensure (и stop во время wait_ready не «теряет» child).
    pub start_lock: tokio::sync::Mutex<()>,
}

impl IpfsManager {
    pub fn new(paths: IpfsPaths) -> Self {
        Self {
            state: Arc::new(RwLock::new(IpfsState::default())),
            paths,
            child: StdMutex::new(None),
            start_lock: tokio::sync::Mutex::new(()),
        }
    }

    pub async fn emit_state(&self, app: &AppHandle) {
        use tauri::Emitter;
        let snapshot = self.state.read().await.snapshot();
        let _ = app.emit("ipfs:state", &snapshot);
    }
}

fn err_string<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Снапшот + дешёвая проверка живости: свой child мог умереть (OOM, внешний
/// kill) — иначе состояние навсегда оставалось бы «Running» с мёртвыми портами.
#[tauri::command]
pub async fn ipfs_status(mgr: State<'_, IpfsManager>) -> Result<IpfsStateSnapshot, String> {
    reap_dead_child(&mgr).await;
    let installed = mgr.paths.binary.is_file();
    let update_available = installer::update_available(&mgr.paths);
    let mut st = mgr.state.write().await;
    st.installed = installed;
    st.update_available = update_available;
    Ok(st.snapshot())
}

/// Идемпотентная точка входа для фронтенда: установить (если нужно) + запустить
/// демон + вернуть снапшот с `gateway_port`. Повторные вызовы во время работы
/// сразу возвращают текущее состояние.
#[tauri::command]
pub async fn ipfs_ensure(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<IpfsStateSnapshot, String> {
    // Быстрый путь без блокировки (с проверкой, что child не умер).
    reap_dead_child(&mgr).await;
    {
        let st = mgr.state.read().await;
        if st.status == IpfsStatus::Running && st.gateway_port != 0 {
            return Ok(st.snapshot());
        }
    }

    // Сериализуем весь цикл подготовки: конкурентные клики не плодят демонов.
    let _guard = mgr.start_lock.lock().await;

    // Другой клик мог всё поднять, пока мы ждали блокировку.
    {
        let st = mgr.state.read().await;
        if st.status == IpfsStatus::Running && st.gateway_port != 0 {
            return Ok(st.snapshot());
        }
    }

    // 1. Присоединиться к осиротевшему демону от прошлого запуска, если жив.
    if let Some((api, gw)) = try_attach(&mgr.paths).await {
        {
            let mut st = mgr.state.write().await;
            st.api_port = api;
            st.gateway_port = gw;
            st.status = IpfsStatus::Running;
            st.installed = true;
            st.update_available = installer::update_available(&mgr.paths);
            st.message = None;
            st.lock_error = false;
        }
        mgr.emit_state(&app).await;
        return Ok(mgr.state.read().await.snapshot());
    }

    // 2. Установка бинаря.
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Installing;
        st.message = Some("Preparing IPFS".into());
        st.lock_error = false;
    }
    mgr.emit_state(&app).await;
    installer::ensure_installed(&app, &mgr.paths)
        .await
        .map_err(err_string)?;
    {
        let mut st = mgr.state.write().await;
        st.installed = true;
        st.update_available = installer::update_available(&mgr.paths);
    }

    // 3. Инициализация репозитория (один раз).
    if !mgr.paths.repo.join("config").exists() {
        std::fs::create_dir_all(&mgr.paths.repo).map_err(err_string)?;
        run_ipfs(
            &mgr.paths,
            &["init", &format!("--profile={}", config::INIT_PROFILE)],
        )
        .await?;
    }

    // 4. Конфигурация ноды (порты /tcp/0, autoclient, Provide=pinned, CORS) +
    //    bearer-авторизация RPC: без неё любой локальный процесс читал бы конфиг
    //    (в т.ч. токен pin-сервиса) и менял бы адреса API.
    for args in config::config_commands() {
        let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_ipfs(&mgr.paths, &refs).await?;
    }
    let secret = load_or_create_secret(&mgr.paths)?;
    {
        let args = config::api_auth_command(&secret);
        let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_ipfs(&mgr.paths, &refs).await?;
    }

    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Starting;
        st.message = Some("Launching IPFS daemon".into());
    }
    mgr.emit_state(&app).await;

    // 5. Запуск демона.
    let child =
        process::spawn_daemon(app.clone(), &mgr.paths, mgr.state.clone()).map_err(err_string)?;
    let pid = child.pid();
    {
        let mut guard = mgr.child.lock().expect("ipfs child mutex poisoned");
        *guard = Some(child);
    }
    {
        let mut st = mgr.state.write().await;
        st.child_pid = Some(pid);
    }

    // 6. Готовность: реальные порты из файлов api/gateway + живой API.
    match wait_ready(&mgr.paths, &mgr.state, config::DAEMON_READY_TIMEOUT_SECS).await {
        Some((api, gw)) => {
            let mut st = mgr.state.write().await;
            st.api_port = api;
            st.gateway_port = gw;
            st.status = IpfsStatus::Running;
            st.message = None;
        }
        None => {
            // Гасим неподнявшийся демон, чтобы не завис.
            if let Some(mut c) = mgr.child.lock().expect("ipfs child mutex poisoned").take() {
                let _ = process::kill(&mut c);
            }
            {
                let mut st = mgr.state.write().await;
                st.status = IpfsStatus::Failed;
                st.child_pid = None;
                if st.message.is_none() {
                    st.message = Some("IPFS daemon did not become ready".into());
                }
            }
            mgr.emit_state(&app).await;
            return Err("IPFS daemon did not become ready".into());
        }
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn ipfs_stop(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<IpfsStateSnapshot, String> {
    let _guard = mgr.start_lock.lock().await;
    stop_daemon(&mgr).await;
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Off;
        st.message = None;
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn ipfs_uninstall(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<IpfsStateSnapshot, String> {
    let _guard = mgr.start_lock.lock().await;
    // Сначала гасим (в т.ч. усыновлённый), иначе remove_dir_all под живым
    // процессом: на Windows repo.lock не удалится и следующий ensure упрётся в него.
    stop_daemon(&mgr).await;
    // Освобождаем диск: и бинарь, и repo (кэш блоков может быть крупным), и секрет.
    let _ = std::fs::remove_dir_all(&mgr.paths.bin_dir);
    let _ = std::fs::remove_dir_all(&mgr.paths.repo);
    let _ = std::fs::remove_file(&mgr.paths.api_secret);
    {
        let mut st = mgr.state.write().await;
        *st = IpfsState::default();
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

/// Обновление: гасим демон и сносим ТОЛЬКО бинарь (repo/кэш блоков сохраняем).
/// Следующий `ipfs_ensure` докачает запиненную версию и переиспользует repo.
#[tauri::command]
pub async fn ipfs_update(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<IpfsStateSnapshot, String> {
    let _guard = mgr.start_lock.lock().await;
    // Усыновлённый демон тоже гасим — иначе после удаления бинаря ensure снова
    // «усыновил» бы старую версию, а бинаря на диске уже нет.
    stop_daemon(&mgr).await;
    let _ = std::fs::remove_dir_all(&mgr.paths.bin_dir);
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Off;
        st.installed = false;
        st.update_available = false;
        st.message = None;
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

/// Окно-просмотрщик IPFS-контента. Создаётся в Rust, а не из JS, чтобы:
///   - `incognito`: у каждого окна эфемерный storage — все IPFS-сайты живут на
///     одном origin (path-gateway 127.0.0.1:<gw>), иначе вредоносный сайт читал
///     бы localStorage/IndexedDB другого;
///   - `on_navigation`: страница не уведёт окно с титулом «IPFS · …» на
///     произвольный сайт (фишинг) или другой локальный порт.
/// URL валидируется по белому списку (наш gateway-порт или публичный шлюз):
/// у JS нет права открыть окно с чем угодно. Повторный вызов — фокус.
#[tauri::command]
pub async fn ipfs_open_viewer(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
    label: String,
    url: String,
    title: String,
) -> Result<(), String> {
    if !is_valid_viewer_label(&label) {
        return Err("invalid viewer window label".into());
    }
    let gw_port = mgr.state.read().await.gateway_port;
    let parsed = tauri::Url::parse(&url).map_err(err_string)?;
    if !viewer_url_allowed(&parsed, gw_port) {
        return Err("url is not allowed for the IPFS viewer".into());
    }
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.set_focus();
        return Ok(());
    }
    let title: String = title.chars().take(80).collect();
    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1100.0, 780.0)
        .incognito(true)
        .on_navigation(move |u| viewer_url_allowed(u, gw_port))
        .build()
        .map_err(err_string)?;
    Ok(())
}

/// Публикация файла в IPFS (write-сторона / файлообменник). Файл выбирает
/// пользователь в НАТИВНОМ диалоге здесь, в Rust: путь из webview не принимаем —
/// иначе XSS в главном окне публиковал бы (= читал) любой файл. Нода должна
/// быть поднята (гейтится на фронте через ensureRunning). `add` пинит локально
/// и сразу анонсирует CID (см. provide_once_background). None = отмена.
///
/// ВАЖНО: контент ПУБЛИЧНЫЙ — любой с этим CID скачает его. Для приватных файлов
/// есть ipfs_add_encrypted.
#[tauri::command]
pub async fn ipfs_add(app: AppHandle, mgr: State<'_, IpfsManager>) -> Result<Option<String>, String> {
    let Some(path) = pick_file(&app).await else {
        return Ok(None);
    };
    let path_s = path.to_string_lossy().to_string();
    let cid = run_ipfs(
        &mgr.paths,
        &["add", "-Q", "--cid-version=1", "--pin=true", "--", &path_s],
    )
    .await?;
    let cid = cid.trim().to_string();
    if cid.is_empty() {
        return Err("ipfs add returned empty CID".into());
    }
    provide_once_background(mgr.paths.clone(), cid.clone());
    Ok(Some(cid))
}

#[derive(serde::Serialize)]
pub struct EncryptedAddResult {
    pub cid: String,
    pub key: String,
    /// Имя выбранного файла — поедет во фрагменте ссылки (`#…&name=`).
    pub name: String,
}

/// Приватная публикация: шифруем файл случайным ключом (AES-256-GCM) и кладём
/// ШИФРТЕКСТ в IPFS. Ключ возвращаем — он поедет во фрагменте ссылки, не на
/// gateway. Публичным остаётся лишь непонятный блоб. Файл — из нативного
/// диалога (см. ipfs_add). None = отмена.
#[tauri::command]
pub async fn ipfs_add_encrypted(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<Option<EncryptedAddResult>, String> {
    let Some(path) = pick_file(&app).await else {
        return Ok(None);
    };
    let meta = std::fs::metadata(&path).map_err(err_string)?;
    if !meta.is_file() {
        return Err("not a regular file".into());
    }
    if meta.len() > config::MAX_ENCRYPTED_BYTES {
        return Err(format!(
            "file is too large for private sharing (limit {} MB)",
            config::MAX_ENCRYPTED_BYTES / (1024 * 1024)
        ));
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let plaintext = std::fs::read(&path).map_err(err_string)?;
    let (key, blob) = crypto::encrypt(&plaintext).map_err(err_string)?;
    drop(plaintext);

    // Временный файл под шифртекст (ipfs add берёт путь).
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("bastyon-ipfs-{}-{}.enc", std::process::id(), stamp));
    write_private(&tmp, &blob).map_err(err_string)?;
    drop(blob);

    let tmp_s = tmp.to_string_lossy().to_string();
    let add = run_ipfs(
        &mgr.paths,
        &["add", "-Q", "--cid-version=1", "--pin=true", "--", &tmp_s],
    )
    .await;
    let _ = std::fs::remove_file(&tmp);

    let cid = add?.trim().to_string();
    if cid.is_empty() {
        return Err("ipfs add returned empty CID".into());
    }
    provide_once_background(mgr.paths.clone(), cid.clone());
    Ok(Some(EncryptedAddResult { cid, key, name }))
}

/// Открытие приватного файла: тянем ШИФРТЕКСТ, расшифровываем ключом из ссылки
/// и пишем расшифрованное туда, куда пользователь укажет в НАТИВНОМ диалоге
/// (dest из webview не принимаем — это был бы примитив записи по любому пути).
/// `source` — не URL, а "local" | "public": URL собирается здесь по белому списку
/// (никакого SSRF на произвольный хост). Ok(false) = отмена диалога.
#[tauri::command]
pub async fn ipfs_save_encrypted(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
    source: String,
    cid: String,
    key: String,
    suggested_name: String,
) -> Result<bool, String> {
    if !is_plausible_cid(&cid) {
        return Err("invalid CID".into());
    }
    let base = match source.as_str() {
        "public" => config::PUBLIC_GATEWAY.to_string(),
        "local" => {
            let gw = mgr.state.read().await.gateway_port;
            if gw == 0 {
                return Err("local IPFS node is not running".into());
            }
            format!("http://127.0.0.1:{gw}")
        }
        _ => return Err("unknown gateway source".into()),
    };
    let url = format!("{base}/ipfs/{cid}");

    let Some(dest) = save_file(&app, &safe_basename(&suggested_name, &cid)).await else {
        return Ok(false);
    };

    // Таймаут: на «холодном» CID нода может не отдать блоки — не висим вечно.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(err_string)?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(err_string)?
        .error_for_status()
        .map_err(err_string)?;
    // Потолок объёма: и по заголовку, и по факту — иначе гигабайты за 60 с → OOM.
    if resp.content_length().unwrap_or(0) > config::MAX_ENCRYPTED_BYTES {
        return Err("file is too large".into());
    }
    let bytes = read_body_capped(resp, config::MAX_ENCRYPTED_BYTES).await?;
    let plain = crypto::decrypt(&key, &bytes).map_err(err_string)?;
    drop(bytes);
    std::fs::write(&dest, plain).map_err(err_string)?;
    Ok(true)
}

// ---------------------------------------------------------------------------
// Удалённый pin (Ф5c) — durability через IPFS Pinning Service API.
// Сервис (endpoint+token) хранит сам Kubo в своём конфиге. Работает со сторонним
// провайдером (Pinata/web3.storage) или ipfs-cluster на своём VPS.
// ---------------------------------------------------------------------------

/// Задать/пересоздать удалённый pinning-сервис (идемпотентно: rm + add).
/// Только https: иначе токен уходил бы открытым текстом в каждом запросе Kubo.
#[tauri::command]
pub async fn ipfs_pin_service_set(
    endpoint: String,
    key: String,
    mgr: State<'_, IpfsManager>,
) -> Result<(), String> {
    let endpoint = endpoint.trim().to_string();
    let key = key.trim().to_string();
    if !endpoint.starts_with("https://") {
        return Err("pinning service endpoint must use https://".into());
    }
    if key.is_empty() || key.contains(char::is_whitespace) {
        return Err("invalid pinning service key".into());
    }
    let _ = run_ipfs(
        &mgr.paths,
        &["pin", "remote", "service", "rm", "--", config::REMOTE_PIN_SERVICE],
    )
    .await;
    run_ipfs(
        &mgr.paths,
        &[
            "pin",
            "remote",
            "service",
            "add",
            "--",
            config::REMOTE_PIN_SERVICE,
            &endpoint,
            &key,
        ],
    )
    .await?;
    Ok(())
}

/// Настроен ли удалённый pinning-сервис.
#[tauri::command]
pub async fn ipfs_pin_service_status(mgr: State<'_, IpfsManager>) -> Result<bool, String> {
    let out = run_ipfs(&mgr.paths, &["pin", "remote", "service", "ls"])
        .await
        .unwrap_or_default();
    Ok(out.contains(config::REMOTE_PIN_SERVICE))
}

/// Удалить настроенный удалённый pinning-сервис.
#[tauri::command]
pub async fn ipfs_pin_service_clear(mgr: State<'_, IpfsManager>) -> Result<(), String> {
    let _ = run_ipfs(
        &mgr.paths,
        &["pin", "remote", "service", "rm", "--", config::REMOTE_PIN_SERVICE],
    )
    .await;
    Ok(())
}

/// Запинить CID на удалённом сервисе (в фоне). Best-effort: без сервиса вернёт Err.
#[tauri::command]
pub async fn ipfs_pin_remote(cid: String, mgr: State<'_, IpfsManager>) -> Result<(), String> {
    if !is_plausible_cid(&cid) {
        return Err("invalid CID".into());
    }
    run_ipfs(
        &mgr.paths,
        &[
            "pin",
            "remote",
            "add",
            &format!("--service={}", config::REMOTE_PIN_SERVICE),
            "--background",
            "--",
            &cid,
        ],
    )
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Внутреннее
// ---------------------------------------------------------------------------

/// Немедленный анонс свежедобавленного CID в DHT (`ipfs provide once`), не
/// дожидаясь периодического reprovide по Provide.DHT.Interval: пользователь
/// шлёт ссылку сразу после «Поделиться». Фоново, best-effort — DHT PUT занимает
/// секунды, а результат `add` UI уже показал. Ошибка только в лог.
fn provide_once_background(paths: IpfsPaths, cid: String) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_ipfs(&paths, &["provide", "once", "--", &cid]).await {
            log::warn!("[ipfs] provide once {cid} failed: {e}");
        }
    });
}

/// Короткоживущий вызов `ipfs <args>` с нашим IPFS_PATH. Если есть секрет RPC —
/// предъявляем его (`--api-auth`): при запущенном демоне CLI ходит через RPC.
/// Ошибка → stderr текстом.
async fn run_ipfs(paths: &IpfsPaths, args: &[&str]) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new(&paths.binary);
    if let Some(secret) = read_secret(paths) {
        cmd.arg(format!("--api-auth=bearer:{secret}"));
    }
    cmd.args(args)
        .env("IPFS_PATH", &paths.repo)
        .env("IPFS_TELEMETRY", "off");
    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW — не мигать консолью на каждый вызов.
        cmd.creation_flags(0x08000000);
    }
    let out = cmd.output().await.map_err(err_string)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Bearer-секрет RPC: из файла, либо создаём (32 байта CSPRNG → hex, файл 0600).
fn load_or_create_secret(paths: &IpfsPaths) -> Result<String, String> {
    if let Some(s) = read_secret(paths) {
        return Ok(s);
    }
    let s = crypto::random_hex(32);
    if let Some(dir) = paths.api_secret.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    write_private(&paths.api_secret, s.as_bytes()).map_err(err_string)?;
    Ok(s)
}

/// Секрет RPC, если файл есть и валиден. None = репо/демон до ввода auth
/// (probe без заголовка всё равно пройдёт: демон без Authorizations его не ждёт).
fn read_secret(paths: &IpfsPaths) -> Option<String> {
    let s = std::fs::read_to_string(&paths.api_secret).ok()?;
    let s = s.trim().to_string();
    (s.len() >= 32 && s.chars().all(|c| c.is_ascii_hexdigit())).then_some(s)
}

/// Файл, читаемый только владельцем (секрет, временный шифртекст).
fn write_private(path: &Path, data: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut f = opts.open(path)?;
    f.write_all(data)
}

/// Нативный диалог выбора файла (main thread — внутри плагина). None = отмена.
async fn pick_file(app: &AppHandle) -> Option<PathBuf> {
    use tauri_plugin_dialog::DialogExt;
    let dialog = app.dialog().file();
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_file())
        .await
        .ok()
        .flatten()?;
    picked.into_path().ok()
}

/// Нативный диалог сохранения с предложенным именем. None = отмена.
async fn save_file(app: &AppHandle, suggested: &str) -> Option<PathBuf> {
    use tauri_plugin_dialog::DialogExt;
    let dialog = app.dialog().file().set_file_name(suggested);
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file())
        .await
        .ok()
        .flatten()?;
    picked.into_path().ok()
}

/// Имя для диалога из НЕДОВЕРЕННОЙ строки (фрагмент ссылки): только basename,
/// без разделителей/управляющих, ограниченной длины; пустое → `<cid16>.bin`.
fn safe_basename(name: &str, cid: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .take(200)
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.').to_string();
    if cleaned.is_empty() {
        format!("{}.bin", cid.chars().take(16).collect::<String>())
    } else {
        cleaned
    }
}

/// CID/IPNS-имя без разделителей пути: чтобы `..` не вывел URL за `/ipfs/`.
fn is_plausible_cid(cid: &str) -> bool {
    cid.len() >= 10 && cid.len() <= 256 && cid.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Метка viewer-окна из фронта: `ipfs-<ns>-<alnum>` (никогда не `main`).
fn is_valid_viewer_label(label: &str) -> bool {
    label.starts_with("ipfs-")
        && label.len() <= 64
        && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Куда viewer-окну можно ходить: наш gateway-порт на loopback (и только он —
/// не API-порт, не другие локальные сервисы) или публичный шлюз по https.
fn viewer_url_allowed(u: &tauri::Url, gw_port: u16) -> bool {
    match (u.scheme(), u.host_str()) {
        ("http", Some("127.0.0.1")) => gw_port != 0 && u.port() == Some(gw_port),
        ("https", Some(host)) => host == "dweb.link" || host.ends_with(".dweb.link"),
        _ => false,
    }
}

/// Читаем тело кусками с потолком — `bytes()` целиком доверился бы серверу.
async fn read_body_capped(mut resp: reqwest::Response, cap: u64) -> Result<Vec<u8>, String> {
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(err_string)? {
        if (buf.len() as u64 + chunk.len() as u64) > cap {
            return Err("file is too large".into());
        }
        buf.extend_from_slice(&chunk);
    }
    Ok(buf)
}

fn read_api_port(paths: &IpfsPaths) -> Option<u16> {
    let raw = std::fs::read_to_string(paths.repo.join(config::IPFS_API_FILE)).ok()?;
    config::parse_api_multiaddr(&raw)
}

fn read_gateway_port(paths: &IpfsPaths) -> Option<u16> {
    let raw = std::fs::read_to_string(paths.repo.join(config::IPFS_GATEWAY_FILE)).ok()?;
    config::parse_gateway_url(&raw)
}

/// HTTP-клиент для probe-запросов: короткий таймаут обязателен — протухший
/// `api`-файл может указывать на порт, который принимает соединение и молчит.
fn probe_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(config::PROBE_TIMEOUT_SECS))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

/// `POST /api/v0/id` с auth → PeerID живого Kubo. None = не отвечает / не Kubo /
/// отказ по auth. «Любой 2xx» не годится: dev-сервер на том же порту сошёл бы
/// за ноду.
async fn api_peer_id(paths: &IpfsPaths, api_port: u16) -> Option<String> {
    let mut req = probe_client().post(format!("http://127.0.0.1:{api_port}/api/v0/id"));
    if let Some(s) = read_secret(paths) {
        req = req.bearer_auth(s);
    }
    let resp = req.send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let v: serde_json::Value = resp.json().await.ok()?;
    v.get("ID")?.as_str().map(|s| s.to_string())
}

/// `Identity.PeerID` нашего repo — чтобы «усыновить» именно свой демон.
fn repo_peer_id(paths: &IpfsPaths) -> Option<String> {
    let raw = std::fs::read_to_string(paths.repo.join("config")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("Identity")?.get("PeerID")?.as_str().map(|s| s.to_string())
}

/// Живой демон пишет свой адрес в `$IPFS_PATH/api`. Файл мог остаться и от
/// мёртвого процесса (SIGKILL/краш) — проверяем ответ API и совпадение PeerID.
/// Не наш/мёртвый → удаляем протухшие `api`/`gateway`, иначе wait_ready после
/// spawn прочитал бы старый gateway-порт при уже живом новом API.
async fn try_attach(paths: &IpfsPaths) -> Option<(u16, u16)> {
    if let Some(api_port) = read_api_port(paths) {
        let live = api_peer_id(paths, api_port).await;
        let ours = repo_peer_id(paths);
        if let (Some(l), Some(o)) = (live, ours) {
            if l == o {
                if let Some(gw) = read_gateway_port(paths) {
                    return Some((api_port, gw));
                }
            }
        }
    }
    let _ = std::fs::remove_file(paths.repo.join(config::IPFS_API_FILE));
    let _ = std::fs::remove_file(paths.repo.join(config::IPFS_GATEWAY_FILE));
    None
}

/// Демон поднимается не мгновенно. Готовность = файлы api/gateway записаны
/// (значит слушатели живы) И API отвечает нашим PeerID. Lock-error из stderr
/// (repo занят другим процессом) — сразу None, а не 60 с ожидания.
async fn wait_ready(
    paths: &IpfsPaths,
    shared: &SharedIpfsState,
    timeout_secs: u64,
) -> Option<(u16, u16)> {
    let ours = repo_peer_id(paths);
    for _ in 0..(timeout_secs * 2) {
        if shared.read().await.lock_error {
            return None;
        }
        if let Some(api_port) = read_api_port(paths) {
            if let Some(live) = api_peer_id(paths, api_port).await {
                if ours.as_deref().map_or(true, |o| o == live) {
                    if let Some(gw_port) = read_gateway_port(paths) {
                        return Some((api_port, gw_port));
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    None
}

/// Свой child умер (OOM, внешний kill)? Снимаем «Running», чтобы фронт не
/// открывал окна на мёртвый порт и ensure поднял демон заново.
async fn reap_dead_child(mgr: &IpfsManager) {
    let exited = {
        let mut guard = mgr.child.lock().expect("ipfs child mutex poisoned");
        match guard.as_mut() {
            Some(c) => match c.child.try_wait() {
                Ok(Some(_)) | Err(_) => {
                    guard.take();
                    true
                }
                Ok(None) => false,
            },
            None => false,
        }
    };
    if exited {
        let mut st = mgr.state.write().await;
        if st.status == IpfsStatus::Running || st.status == IpfsStatus::Starting {
            st.status = IpfsStatus::Failed;
            st.message = Some("IPFS daemon exited unexpectedly".into());
        }
        st.child_pid = None;
        st.api_port = 0;
        st.gateway_port = 0;
    }
}

/// Порт слушает? (для ожидания завершения усыновлённого демона)
async fn port_open(port: u16) -> bool {
    tokio::time::timeout(
        Duration::from_millis(300),
        tokio::net::TcpStream::connect(("127.0.0.1", port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false)
}

/// Остановить демон, чей бы он ни был: свой child — graceful shutdown + kill;
/// усыновлённый (pid неизвестен) — shutdown по RPC и ждём, пока порт закроется.
/// После возврата процесс не держит repo (насколько мы можем это гарантировать).
async fn stop_daemon(mgr: &IpfsManager) {
    let api_port = mgr.state.read().await.api_port;
    if api_port != 0 {
        let mut req = probe_client().post(format!("http://127.0.0.1:{api_port}/api/v0/shutdown"));
        if let Some(s) = read_secret(&mgr.paths) {
            req = req.bearer_auth(s);
        }
        let _ = req.send().await;
    }
    let child = mgr.child.lock().expect("ipfs child mutex poisoned").take();
    match child {
        Some(mut c) => {
            let _ = process::kill(&mut c);
        }
        None if api_port != 0 => {
            for _ in 0..50 {
                if !port_open(api_port).await {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
        None => {}
    }
    let mut st = mgr.state.write().await;
    st.child_pid = None;
    st.gateway_port = 0;
    st.api_port = 0;
}

/// Синхронный graceful shutdown для обработчика выхода приложения (там нет
/// tokio-рантайма): сырой HTTP POST на loopback. Гасит и усыновлённого демона,
/// которого `child.kill()` не видит — иначе сирота жил бы через все сессии.
pub fn shutdown_on_exit(mgr: &IpfsManager) {
    use std::io::Write;
    let api_port = mgr
        .state
        .try_read()
        .map(|st| st.api_port)
        .unwrap_or(0);
    if api_port != 0 {
        let addr = std::net::SocketAddr::from(([127, 0, 0, 1], api_port));
        if let Ok(mut s) = std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
            let _ = s.set_write_timeout(Some(Duration::from_millis(500)));
            let auth = read_secret(&mgr.paths)
                .map(|t| format!("Authorization: Bearer {t}\r\n"))
                .unwrap_or_default();
            let _ = write!(
                s,
                "POST /api/v0/shutdown HTTP/1.1\r\nHost: 127.0.0.1\r\n{auth}Content-Length: 0\r\nConnection: close\r\n\r\n"
            );
        }
    }
    if let Ok(mut guard) = mgr.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = process::kill(&mut child);
        }
    }
}

/// Инициализация менеджера и регистрация в app state. Вызывается один раз из setup.
pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Бинарь — в перекачиваемый cache; repo (IPFS_PATH) — в data.
    let bin_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_local_data_dir())?
        .join("ipfs");
    let repo = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?
        .join("ipfs")
        .join("repo");
    std::fs::create_dir_all(&bin_dir)?;
    std::fs::create_dir_all(&repo)?;
    let paths = IpfsPaths::new(bin_dir, repo);
    app.manage(IpfsManager::new(paths));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn viewer_url_whitelist() {
        let ok = |s: &str, gw: u16| viewer_url_allowed(&tauri::Url::parse(s).unwrap(), gw);
        assert!(ok("http://127.0.0.1:8080/ipfs/bafy", 8080));
        assert!(!ok("http://127.0.0.1:5001/api/v0/id", 8080)); // API-порт
        assert!(!ok("http://127.0.0.1:8080/ipfs/bafy", 0)); // нода не запущена
        assert!(!ok("http://localhost:8080/ipfs/bafy", 8080)); // только 127.0.0.1
        assert!(ok("https://dweb.link/ipfs/bafy", 0));
        assert!(ok("https://bafy.ipfs.dweb.link/", 0));
        assert!(!ok("http://dweb.link/ipfs/bafy", 0)); // публичный только https
        assert!(!ok("https://evil.example/", 8080));
        assert!(!ok("https://notdweb.link/", 8080));
        assert!(!ok("javascript:alert(1)", 8080));
    }

    #[test]
    fn viewer_label_format() {
        assert!(is_valid_viewer_label("ipfs-ipfs-bafyabc"));
        assert!(is_valid_viewer_label("ipfs-ipns-k51abc"));
        assert!(!is_valid_viewer_label("main"));
        assert!(!is_valid_viewer_label("ipfs-a/b"));
        assert!(!is_valid_viewer_label(""));
    }

    #[test]
    fn cid_plausibility_rejects_path_tricks() {
        assert!(is_plausible_cid("bafybeia3mpj3u3ljhaultrortqwy3nfnqwdzthi2bly6qkp4pimeol6d3m"));
        assert!(is_plausible_cid("QmePA8uKLkLEqCeT3Nz2QKVb1Pv1nVL9kCrUKsw3AZ2CKp"));
        assert!(!is_plausible_cid(".."));
        assert!(!is_plausible_cid("../../api/v0/id"));
        assert!(!is_plausible_cid("bafy/../x"));
        assert!(!is_plausible_cid("short"));
    }

    #[test]
    fn safe_basename_strips_dirs_and_controls() {
        assert_eq!(safe_basename("/Users/u/.ssh/authorized_keys", "cid"), "authorized_keys");
        assert_eq!(safe_basename("..\\..\\evil.exe", "cid"), "evil.exe");
        assert_eq!(safe_basename("my photo.png", "cid"), "my photo.png");
        assert_eq!(safe_basename("a\nb:c?.txt", "cid"), "abc.txt");
        assert_eq!(safe_basename("...", "bafyabcdefghijklmnop"), "bafyabcdefghijkl.bin"); // 16 символов CID
        assert_eq!(safe_basename("", "bafy"), "bafy.bin");
    }

    #[test]
    fn secret_roundtrip_and_validation() {
        let dir = std::env::temp_dir().join(format!("bastyon-ipfs-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let paths = IpfsPaths::new(dir.join("cache"), dir.join("data").join("repo"));
        assert!(read_secret(&paths).is_none());
        let s1 = load_or_create_secret(&paths).unwrap();
        let s2 = load_or_create_secret(&paths).unwrap();
        assert_eq!(s1, s2, "секрет стабилен между вызовами");
        assert_eq!(s1.len(), 64);
        // Мусор в файле не считается секретом → пересоздаётся.
        std::fs::write(&paths.api_secret, "not-hex!").unwrap();
        assert!(read_secret(&paths).is_none());
        let s3 = load_or_create_secret(&paths).unwrap();
        assert_ne!(s3, "not-hex!");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&paths.api_secret).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
