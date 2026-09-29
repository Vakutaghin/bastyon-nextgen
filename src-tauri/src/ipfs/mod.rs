pub mod config;
pub mod crypto;
pub mod installer;
pub mod process;
pub mod shares;
pub mod state;
pub mod verify;

use crate::ipfs::process::IpfsChild;
use crate::ipfs::state::{IpfsPaths, IpfsState, IpfsStateSnapshot, IpfsStatus, SharedIpfsState};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{watch, RwLock};

pub struct IpfsManager {
    pub state: SharedIpfsState,
    pub paths: IpfsPaths,
    /// Держится синхронно; kill в обработчике выхода не требует tokio-рантайма.
    pub child: StdMutex<Option<IpfsChild>>,
    /// Сериализует ensure/stop/update/uninstall: параллельные клики не поднимают
    /// два демона на один repo, а update во время распаковки не сносит bin_dir
    /// из-под ensure (и stop во время wait_ready не «теряет» child).
    pub start_lock: tokio::sync::Mutex<()>,
    /// Сериализует чтение-изменение-запись реестров «Моих файлов».
    pub shares_lock: tokio::sync::Mutex<()>,
    /// Отмена установки (ipfs_cancel_install). Не под start_lock: его держит
    /// сама установка, которую надо прервать.
    pub install_cancel: watch::Sender<bool>,
    /// Файлы, выбранные в нативном диалоге: токен → путь. Webview получает
    /// только токен, путь из него не принимается (см. ipfs_pick_files).
    pub picked: StdMutex<HashMap<String, PathBuf>>,
    /// Идущие сохранения: id из фронта → сигнал отмены (ipfs_cancel_save).
    pub saves: StdMutex<HashMap<String, watch::Sender<bool>>>,
}

impl IpfsManager {
    pub fn new(paths: IpfsPaths) -> Self {
        Self {
            state: Arc::new(RwLock::new(IpfsState::default())),
            paths,
            child: StdMutex::new(None),
            start_lock: tokio::sync::Mutex::new(()),
            shares_lock: tokio::sync::Mutex::new(()),
            install_cancel: watch::channel(false).0,
            picked: StdMutex::new(HashMap::new()),
            saves: StdMutex::new(HashMap::new()),
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

    // 2–4. Установка, init, конфигурация. Новая попытка — прежняя отмена к ней
    //      не относится.
    mgr.install_cancel.send_replace(false);
    let cancel = mgr.install_cancel.subscribe();
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Installing;
        st.message = Some("Preparing IPFS".into());
        st.lock_error = false;
    }
    mgr.emit_state(&app).await;
    match prepare_node(&app, &mgr, &cancel).await {
        Ok(()) => {}
        // Отмена — не ошибка: нода просто выключена, ensure отдаёт снапшот `off`.
        Err(PrepareError::Cancelled) => {
            {
                let mut st = mgr.state.write().await;
                st.status = IpfsStatus::Off;
                st.message = None;
                st.installed = mgr.paths.binary.is_file();
            }
            mgr.emit_state(&app).await;
            return Ok(mgr.state.read().await.snapshot());
        }
        // Раньше статус так и оставался `installing`: после перезагрузки окна
        // шапка бесконечно показывала установку.
        Err(PrepareError::Failed(message)) => {
            {
                let mut st = mgr.state.write().await;
                st.status = IpfsStatus::Failed;
                st.message = Some(message.clone());
            }
            mgr.emit_state(&app).await;
            return Err(message);
        }
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

/// Отменить идущую установку. Скачивание прерывается сразу (недокачанный архив
/// удаляется), распаковка/init — на ближайшей границе фаз; начавшийся запуск
/// демона не прерывается. Без идущей установки флаг сбросит следующий ensure.
#[tauri::command]
pub fn ipfs_cancel_install(mgr: State<'_, IpfsManager>) {
    mgr.install_cancel.send_replace(true);
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
    // Раздавать без repo нечего — реестры «Моих файлов» уходят вместе с ним.
    let _ = std::fs::remove_dir_all(&mgr.paths.bin_dir);
    let _ = std::fs::remove_dir_all(&mgr.paths.repo);
    let _ = std::fs::remove_file(&mgr.paths.api_secret);
    let _ = std::fs::remove_dir_all(&mgr.paths.shares_dir);
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

/// Имя и размер выбранного файла. Имя попадает в ссылку, поэтому только UTF-8:
/// иначе Kubo записал бы в каталог одно имя, а в ссылку ушло бы другое.
fn picked_file_info(path: &Path) -> Result<(String, u64), String> {
    let meta = std::fs::metadata(path).map_err(err_string)?;
    if !meta.is_file() {
        return Err("not a regular file".into());
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("the file name is not valid UTF-8")?
        .to_string();
    Ok((name, meta.len()))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Сколько выбранных, но не опубликованных файлов помним (и сколько берём из
/// одного выбора): токены от брошенных выборов не копятся.
const MAX_PICKED: usize = 32;

/// Файл, выбранный для публикации: webview видит имя и размер, но не путь.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFile {
    pub token: String,
    pub name: String,
    pub size: u64,
}

/// Выбор файлов для публикации — в НАТИВНОМ диалоге здесь, в Rust: путь из
/// webview не принимаем, иначе XSS в главном окне публиковал бы (= читал) любой
/// файл. Вместо пути фронт получает токен на каждый файл и публикует по нему
/// (ipfs_publish) — успевает показать имя и размер. Пусто = отмена.
#[tauri::command]
pub async fn ipfs_pick_files(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<Vec<PickedFile>, String> {
    let paths = pick_files(&app).await;
    let mut files = Vec::with_capacity(paths.len());
    let mut picked = mgr.picked.lock().map_err(err_string)?;
    if picked.len() + paths.len() > MAX_PICKED {
        picked.clear();
    }
    for path in paths.into_iter().take(MAX_PICKED) {
        let (name, size) = picked_file_info(&path)?;
        let token = crypto::random_hex(16);
        picked.insert(token.clone(), path);
        files.push(PickedFile { token, name, size });
    }
    Ok(files)
}

/// Публикация выбранного файла (ipfs_pick_files) в «Мои файлы» аккаунта. Нода
/// должна быть поднята (гейтится на фронте через ensureRunning). `add` пинит
/// локально и сразу анонсирует CID (см. provide_once_background).
///
/// Публичный файл кладётся в каталог-обёртку (`-w`): ссылка `ipfs://<каталог>/<имя>`
/// несёт имя и тип, получатель видит их до скачивания. Контент ПУБЛИЧНЫЙ — любой
/// с этим CID скачает его. Приватный шифруется случайным ключом (AES-256-GCM),
/// в IPFS уходит только шифртекст — без обёртки, иначе имя стало бы публичным;
/// ключ едет во фрагменте ссылки.
#[tauri::command]
pub async fn ipfs_publish(
    mgr: State<'_, IpfsManager>,
    account: String,
    token: String,
    private: bool,
) -> Result<shares::ShareEntry, String> {
    shares::check_account(&account)?;
    let path = mgr
        .picked
        .lock()
        .map_err(err_string)?
        .remove(&token)
        .ok_or("the picked file is no longer available")?;
    // Файл могли изменить после выбора — имя и размер берём заново.
    let (name, size) = picked_file_info(&path)?;
    let (cid, key) = if private {
        add_encrypted(&mgr.paths, &path).await?
    } else {
        let path_s = path.to_string_lossy().to_string();
        let args = ["add", "-Q", "-w", "--cid-version=1", "--pin=true", "--", &path_s];
        (run_ipfs(&mgr.paths, &args).await?, None)
    };
    let cid = cid.trim().to_string();
    if cid.is_empty() {
        return Err("ipfs add returned empty CID".into());
    }
    provide_once_background(mgr.paths.clone(), cid.clone());
    let entry = shares::ShareEntry {
        cid,
        name,
        size,
        added_at: now_ms(),
        key,
        received: false,
    };
    let _guard = mgr.shares_lock.lock().await;
    shares::record(&mgr.paths.shares_dir, &account, entry.clone())?;
    Ok(entry)
}

/// Шифртекст файла в IPFS: (CID, ключ base64). Формат v2 — кусками
/// (crypto::encrypt_stream): файл не читается в память целиком, потолка нет.
async fn add_encrypted(paths: &IpfsPaths, path: &Path) -> Result<(String, Option<String>), String> {
    // Временный файл под шифртекст (ipfs add берёт путь).
    let tmp = TempFile::new("enc");
    let (src, dst) = (path.to_path_buf(), tmp.0.clone());
    let key = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let input = std::io::BufReader::new(std::fs::File::open(&src).map_err(err_string)?);
        let output = std::io::BufWriter::new(create_private(&dst).map_err(err_string)?);
        crypto::encrypt_stream(input, output).map_err(err_string)
    })
    .await
    .map_err(err_string)??;
    let tmp_s = tmp.0.to_string_lossy().to_string();
    let cid = run_ipfs(
        paths,
        &["add", "-Q", "--cid-version=1", "--pin=true", "--", &tmp_s],
    )
    .await?;
    Ok((cid, Some(key)))
}

/// «Раздавать дальше»: получатель закрепляет у себя чужой файл из чата и тоже
/// становится его источником — файл живёт, пока в сети хоть кто-то из получивших.
/// Kubo тянет блоки из сети (или берёт из кэша после скачивания), поэтому нода
/// должна быть поднята. Файл попадает в «Мои файлы» с пометкой «получен».
#[tauri::command]
pub async fn ipfs_seed(
    mgr: State<'_, IpfsManager>,
    account: String,
    cid: String,
    name: String,
    size: u64,
    key: Option<String>,
) -> Result<shares::ShareEntry, String> {
    shares::check_account(&account)?;
    if !is_plausible_cid(&cid) {
        return Err("invalid CID".into());
    }
    // Имя и ключ пришли из чужого сообщения: в реестр — только разумное.
    let name: String = name.chars().filter(|c| !c.is_control()).take(255).collect();
    let base64 = |c: char| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=');
    if key.as_ref().is_some_and(|k| k.len() > 64 || !k.chars().all(base64)) {
        return Err("invalid key".into());
    }
    run_ipfs(&mgr.paths, &["pin", "add", "--progress=false", "--", &cid]).await?;
    provide_once_background(mgr.paths.clone(), cid.clone());
    let entry = shares::ShareEntry {
        cid,
        name,
        size,
        added_at: now_ms(),
        key,
        received: true,
    };
    let _guard = mgr.shares_lock.lock().await;
    shares::record(&mgr.paths.shares_dir, &account, entry.clone())?;
    Ok(entry)
}

/// Открытие приватного файла: тянем ШИФРТЕКСТ, расшифровываем ключом из ссылки
/// и пишем расшифрованное туда, куда пользователь укажет в НАТИВНОМ диалоге
/// (dest из webview не принимаем — это был бы примитив записи по любому пути).
/// `source` — не URL, а "local" | "public": URL собирается здесь по белому списку
/// (никакого SSRF на произвольный хост). Ok(false) = отмена диалога.
///
/// Шифртекст сначала ложится во временный файл: с публичного шлюза — собранный
/// из CAR с проверкой по CID, как в ipfs_save. Формат узнаётся по заголовку: v2
/// расшифровывается потоком, старый v1 — в памяти (до MAX_ENCRYPTED_BYTES).
/// `id` — для прогресса и отмены (ipfs_cancel_save), `size_hint` — размер из
/// ссылки, итог для прогресса.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ipfs_save_encrypted(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
    source: String,
    cid: String,
    key: String,
    suggested_name: String,
    id: String,
    size_hint: Option<u64>,
) -> Result<bool, String> {
    if !is_plausible_cid(&cid) {
        return Err("invalid CID".into());
    }
    let target = SaveTarget::parse("ipfs", &cid, "")?;
    let local = local_base(&mgr, &source).await?;

    let Some(dest) = save_file(&app, &safe_basename(&suggested_name, &cid)).await else {
        return Ok(false);
    };
    let job = begin_save(&mgr, &app, &id, size_hint)?;
    let _job = SaveGuard(&mgr, &id);

    let cipher = TempFile::new("enc");
    match (&local, target.root_cid.clone()) {
        (Some(local), _) => save_stream(&target.url(local)?, &cipher.0, Some(&job)).await?,
        (None, Some(root)) => save_verified(&target, root, &cipher.0, Some(&job)).await?,
        (None, None) => return Err("invalid CID".into()),
    }
    let part = part_path(&dest);
    let part_out = part.clone();
    let decrypted = tokio::task::spawn_blocking(move || decrypt_file(&key, &cipher.0, &part_out))
        .await
        .map_err(err_string)?;
    match decrypted {
        Ok(()) => {
            std::fs::rename(&part, &dest).map_err(err_string)?;
            Ok(true)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&part);
            Err(e)
        }
    }
}

/// Расшифровка файла в файл: v2 — потоком, v1 — целиком в памяти.
fn decrypt_file(key: &str, src: &Path, dst: &Path) -> Result<(), String> {
    use std::io::{Read, Seek, Write};
    let mut input = std::fs::File::open(src).map_err(err_string)?;
    let mut magic = [0u8; 5];
    let is_v2 = input.read_exact(&mut magic).is_ok()
        && magic[..4] == crypto::STREAM_MAGIC[..]
        && magic[4] == crypto::STREAM_VERSION;
    input.rewind().map_err(err_string)?;
    let mut output = std::io::BufWriter::new(create_private(dst).map_err(err_string)?);
    if is_v2 {
        crypto::decrypt_stream(key, std::io::BufReader::new(input), &mut output, u64::MAX)
            .map_err(err_string)?;
    } else {
        let len = input.metadata().map_err(err_string)?.len();
        if len > config::MAX_ENCRYPTED_BYTES + 28 {
            return Err("file is too large".into());
        }
        let mut blob = Vec::with_capacity(len as usize);
        input.read_to_end(&mut blob).map_err(err_string)?;
        let plain = crypto::decrypt(key, &blob).map_err(err_string)?;
        output.write_all(&plain).map_err(err_string)?;
    }
    output.flush().map_err(err_string)
}

/// Базовый URL локального шлюза для source = "local"; None — публичный шлюз.
async fn local_base(mgr: &IpfsManager, source: &str) -> Result<Option<String>, String> {
    match source {
        "public" => Ok(None),
        "local" => {
            let gw = mgr.state.read().await.gateway_port;
            if gw == 0 {
                return Err("local IPFS node is not running".into());
            }
            Ok(Some(format!("http://127.0.0.1:{gw}")))
        }
        _ => Err("unknown gateway source".into()),
    }
}

/// Сохранить файл по IPFS-ссылке на диск. Куда — пользователь выбирает в
/// НАТИВНОМ диалоге (dest из webview не принимаем), URL собирается здесь из
/// `source` ("local" | "public") и частей ссылки — как у ipfs_save_encrypted.
///
/// С локальной ноды файл идёт потоком: Kubo проверяет блоки сам. С публичного
/// шлюза по `/ipfs/` приходит CAR, и файл собирается с проверкой каждого блока
/// по CID (verify.rs) — подменить содержимое шлюз не может. IPNS-имя через
/// публичный шлюз проверить нечем (DNSLink не подписан), такой файл
/// сохраняется как есть. Пишем в `<имя>.part` и переименовываем только после
/// успеха: оборванная или отвергнутая загрузка не оставляет «готовый» файл.
/// Ok(false) = отмена диалога.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ipfs_save(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
    source: String,
    namespace: String,
    root: String,
    path: String,
    suggested_name: String,
    id: String,
    size_hint: Option<u64>,
) -> Result<bool, String> {
    let target = SaveTarget::parse(&namespace, &root, &path)?;
    let base = local_base(&mgr, &source).await?;

    let Some(dest) = save_file(&app, &safe_basename(&suggested_name, &target.root)).await else {
        return Ok(false);
    };
    let job = begin_save(&mgr, &app, &id, size_hint)?;
    let _job = SaveGuard(&mgr, &id);
    let part = part_path(&dest);
    let saved = match (&base, target.root_cid.clone()) {
        (None, Some(cid)) => save_verified(&target, cid, &part, Some(&job)).await,
        (None, None) => save_stream(&target.url(config::PUBLIC_GATEWAY)?, &part, Some(&job)).await,
        (Some(local), _) => save_stream(&target.url(local)?, &part, Some(&job)).await,
    };
    match saved {
        Ok(()) => {
            std::fs::rename(&part, &dest).map_err(err_string)?;
            Ok(true)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&part);
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// Удалённый pin (Ф5c) — durability через IPFS Pinning Service API.
// Сервис (endpoint+token) хранит сам Kubo в своём конфиге. Работает со сторонним
// провайдером (Pinata, Filebase) или ipfs-cluster на своём VPS.
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

/// Чем закончилась подготовка ноды, если не успехом.
enum PrepareError {
    Cancelled,
    Failed(String),
}

impl From<installer::InstallError> for PrepareError {
    fn from(e: installer::InstallError) -> Self {
        match e {
            installer::InstallError::Cancelled => PrepareError::Cancelled,
            e => PrepareError::Failed(e.to_string()),
        }
    }
}

/// Бинарь, repo и конфиг ноды — всё, что нужно до запуска демона. Отмена
/// проверяется между фазами (скачивание прерывается и посередине).
async fn prepare_node(
    app: &AppHandle,
    mgr: &IpfsManager,
    cancel: &installer::CancelRx,
) -> Result<(), PrepareError> {
    installer::ensure_installed(app, &mgr.paths, cancel).await?;
    {
        let mut st = mgr.state.write().await;
        st.installed = true;
        st.update_available = installer::update_available(&mgr.paths);
    }
    installer::check_cancelled(cancel)?;

    // Инициализация репозитория (один раз).
    if !mgr.paths.repo.join("config").exists() {
        std::fs::create_dir_all(&mgr.paths.repo).map_err(|e| PrepareError::Failed(e.to_string()))?;
        run_ipfs(
            &mgr.paths,
            &["init", &format!("--profile={}", config::INIT_PROFILE)],
        )
        .await
        .map_err(PrepareError::Failed)?;
    }
    installer::check_cancelled(cancel)?;

    // Конфигурация ноды (порты /tcp/0, autoclient, Provide=pinned, CORS) +
    // bearer-авторизация RPC: без неё любой локальный процесс читал бы конфиг
    // (в т.ч. токен pin-сервиса) и менял бы адреса API.
    for args in config::config_commands() {
        let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_ipfs(&mgr.paths, &refs).await.map_err(PrepareError::Failed)?;
    }
    let secret = load_or_create_secret(&mgr.paths).map_err(PrepareError::Failed)?;
    {
        let args = config::api_auth_command(&secret);
        let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_ipfs(&mgr.paths, &refs).await.map_err(PrepareError::Failed)?;
    }
    installer::check_cancelled(cancel)?;
    Ok(())
}

/// Что сохранить: части IPFS-ссылки, проверенные и разобранные. Путь — как в
/// URL (сегменты в %-кодировке): для поиска в DAG нужны настоящие имена, для
/// URL они кодируются заново.
struct SaveTarget {
    namespace: &'static str,
    root: String,
    segments: Vec<String>,
    /// Для `/ipfs/` — корень, по которому проверяется CAR с публичного шлюза.
    root_cid: Option<verify::Cid>,
}

impl SaveTarget {
    fn parse(namespace: &str, root: &str, path: &str) -> Result<SaveTarget, String> {
        let (namespace, root_cid) = match namespace {
            "ipfs" => {
                if !is_plausible_cid(root) {
                    return Err("invalid CID".into());
                }
                // Нераспознанный multibase локальной ноде не помеха, а публичный
                // шлюз без разобранного корня проверить нечем — см. ipfs_save.
                ("ipfs", verify::Cid::parse(root).ok())
            }
            "ipns" => {
                if !is_plausible_ipns_name(root) {
                    return Err("invalid IPNS name".into());
                }
                ("ipns", None)
            }
            _ => return Err("unknown namespace".into()),
        };
        let mut segments = Vec::new();
        for raw in path.split('/').filter(|s| !s.is_empty()) {
            let seg = percent_decode(raw).ok_or("invalid path")?;
            if seg == "." || seg == ".." || seg.chars().any(|c| c == '/' || c == '\\' || c.is_control()) {
                return Err("invalid path".into());
            }
            segments.push(seg);
        }
        Ok(SaveTarget {
            namespace,
            root: root.to_string(),
            segments,
            root_cid,
        })
    }

    /// `<base>/<ns>/<root>/<сегменты>` — каждый сегмент кодирует url::Url.
    fn url(&self, base: &str) -> Result<url::Url, String> {
        let mut url = url::Url::parse(base).map_err(err_string)?;
        url.path_segments_mut()
            .map_err(|_| "bad gateway base".to_string())?
            .push(self.namespace)
            .push(&self.root)
            .extend(&self.segments);
        Ok(url)
    }
}

/// `%XX` → байт; результат обязан быть UTF-8 (имена в UnixFS — строки).
fn percent_decode(seg: &str) -> Option<String> {
    let b = seg.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = b.get(i + 1..i + 3)?;
            if !hex.iter().all(u8::is_ascii_hexdigit) {
                return None;
            }
            out.push(u8::from_str_radix(std::str::from_utf8(hex).ok()?, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// IPNS-имя: ключ (base36/base58) или DNSLink-домен. Без `..` и разделителей.
fn is_plausible_ipns_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 253
        && !name.starts_with('.')
        && !name.contains("..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

/// `photo.jpg` → `photo.jpg.part` рядом: rename в пределах каталога атомарен.
fn part_path(dest: &Path) -> PathBuf {
    let mut name = dest
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_else(|| "download".into());
    name.push(".part");
    dest.with_file_name(name)
}

/// Временный файл, который удаляется при выходе из области видимости.
struct TempFile(PathBuf);

impl TempFile {
    /// Имя уникально в процессе за счёт счётчика: одного времени мало — на
    /// macOS у часов шаг в микросекунду, и два одновременных скачивания
    /// получали один и тот же файл.
    fn new(ext: &str) -> TempFile {
        use std::sync::atomic::{AtomicU64, Ordering};
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let seq = SEQ.fetch_add(1, Ordering::Relaxed);
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        TempFile(std::env::temp_dir().join(format!(
            "bastyon-ipfs-{}-{stamp}-{seq}.{ext}",
            std::process::id()
        )))
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// HTTP-клиент для скачивания файлов: без общего таймаута (файл может быть
/// большим), но с таймаутом тишины. Редиректы — только на https (dweb.link
/// отправляет CAR-запросы на trustless-gateway.link): http-редирект увёл бы
/// запрос на локальные сервисы.
fn download_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() < 5 && attempt.url().scheme() == "https" {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(err_string)
}

/// Ошибка отменённого сохранения — фронт её не показывает.
pub const SAVE_CANCELLED: &str = "cancelled";

/// Идущее сохранение: прогресс для UI (событие `ipfs:save-progress`) и отмена
/// (ipfs_cancel_save), которую ждёт скачивание.
struct SaveJob {
    report: Box<dyn Fn(u64) + Send + Sync>,
    cancel: watch::Receiver<bool>,
}

#[derive(Clone, serde::Serialize)]
struct SaveProgress {
    id: String,
    received: u64,
    total: Option<u64>,
}

/// Сохранение под id из фронта: по нему придут прогресс и отмена.
fn begin_save(
    mgr: &IpfsManager,
    app: &AppHandle,
    id: &str,
    total: Option<u64>,
) -> Result<SaveJob, String> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("invalid save id".into());
    }
    let (tx, cancel) = watch::channel(false);
    mgr.saves.lock().map_err(err_string)?.insert(id.to_string(), tx);
    let (app, id) = (app.clone(), id.to_string());
    let report = move |received| {
        use tauri::Emitter;
        let progress = SaveProgress { id: id.clone(), received, total };
        let _ = app.emit("ipfs:save-progress", progress);
    };
    // Место выбрано, скачивание пошло — UI показывает прогресс сразу, ещё до
    // первых байт (шлюз может искать файл в сети минуту).
    report(0);
    Ok(SaveJob { report: Box::new(report), cancel })
}

/// Снимает сохранение с учёта, когда команда закончилась (как угодно).
struct SaveGuard<'a>(&'a IpfsManager, &'a str);

impl Drop for SaveGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut saves) = self.0.saves.lock() {
            saves.remove(self.1);
        }
    }
}

/// Отменить сохранение: скачивание обрывается, недокачанное удаляется.
#[tauri::command]
pub fn ipfs_cancel_save(id: String, mgr: State<'_, IpfsManager>) {
    if let Ok(saves) = mgr.saves.lock() {
        if let Some(cancel) = saves.get(&id) {
            cancel.send_replace(true);
        }
    }
}

/// Тело ответа потоком в файл (с потолком, если задан). Только 2xx: страница
/// ошибки шлюза не должна сохраниться под именем файла.
async fn fetch_to_file(
    request: reqwest::RequestBuilder,
    dest: &Path,
    cap: Option<u64>,
    job: Option<&SaveJob>,
) -> Result<reqwest::header::HeaderMap, String> {
    use futures_util::StreamExt;
    use std::io::Write;
    let mut cancel = job.map(|j| j.cancel.clone());
    let cancelled = |cancel: &mut Option<watch::Receiver<bool>>| {
        let rx = cancel.clone();
        async move {
            match rx {
                Some(mut rx) => {
                    let _ = rx.wait_for(|c| *c).await;
                    // Отправителя нет (сохранение снято с учёта) — не отмена.
                    if !*rx.borrow() {
                        std::future::pending::<()>().await;
                    }
                }
                None => std::future::pending::<()>().await,
            }
        }
    };
    let resp = tokio::select! {
        resp = request.send() => resp.map_err(err_string)?,
        _ = cancelled(&mut cancel) => return Err(SAVE_CANCELLED.into()),
    };
    if !resp.status().is_success() {
        return Err(format!("gateway responded {}", resp.status()));
    }
    if let (Some(cap), Some(len)) = (cap, resp.content_length()) {
        if len > cap {
            return Err("verify-too-large".into());
        }
    }
    let headers = resp.headers().clone();
    let mut file = std::io::BufWriter::new(std::fs::File::create(dest).map_err(err_string)?);
    let mut written: u64 = 0;
    // Прогресс — по таймеру, а не по кускам: если шлюз притих, UI всё равно
    // видит, сколько уже пришло.
    let mut tick = tokio::time::interval(Duration::from_millis(250));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut reported = 0;
    let mut stream = resp.bytes_stream();
    loop {
        let chunk = tokio::select! {
            chunk = stream.next() => chunk,
            _ = tick.tick(), if job.is_some() => {
                if let Some(job) = job.filter(|_| written != reported) {
                    (job.report)(written);
                    reported = written;
                }
                continue;
            }
            _ = cancelled(&mut cancel) => return Err(SAVE_CANCELLED.into()),
        };
        let Some(chunk) = chunk else { break };
        let chunk = chunk.map_err(err_string)?;
        written += chunk.len() as u64;
        if cap.is_some_and(|c| written > c) {
            return Err("verify-too-large".into());
        }
        file.write_all(&chunk).map_err(err_string)?;
    }
    file.flush().map_err(err_string)?;
    if let Some(job) = job {
        (job.report)(written);
    }
    Ok(headers)
}

/// Как есть, потоком: локальная нода (проверяет сама) или IPNS через шлюз.
async fn save_stream(url: &url::Url, part: &Path, job: Option<&SaveJob>) -> Result<(), String> {
    let client = download_client()?;
    fetch_to_file(client.get(url.clone()), part, None, job).await?;
    Ok(())
}

/// С публичного шлюза: CAR на диск, затем сборка файла с проверкой каждого
/// блока по CID (verify.rs). Файл в `part` появляется только из проверенных
/// блоков.
async fn save_verified(
    target: &SaveTarget,
    root: verify::Cid,
    part: &Path,
    job: Option<&SaveJob>,
) -> Result<(), String> {
    let mut url = target.url(config::PUBLIC_GATEWAY)?;
    url.query_pairs_mut()
        .append_pair("format", "car")
        .append_pair("dag-scope", "entity");
    let car = TempFile::new("car");
    let request = download_client()?.get(url).header(
        reqwest::header::ACCEPT,
        "application/vnd.ipld.car; version=1; order=dfs; dups=n",
    );
    let headers =
        fetch_to_file(request, &car.0, Some(config::MAX_VERIFIED_DOWNLOAD_BYTES), job).await?;
    // Шлюз, не умеющий CAR, отдал бы сам файл — проверить его было бы нечем.
    let is_car = headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/vnd.ipld.car"));
    if !is_car {
        return Err("verify-unsupported: the gateway did not return a CAR".into());
    }
    let segments = target.segments.clone();
    let part = part.to_path_buf();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        use std::io::Write;
        let car_file = std::fs::File::open(&car.0).map_err(err_string)?;
        let mut out = std::io::BufWriter::new(std::fs::File::create(&part).map_err(err_string)?);
        verify::extract_file(
            car_file,
            &root,
            &segments,
            &mut out,
            config::MAX_VERIFIED_DOWNLOAD_BYTES,
        )
        .map_err(err_string)?;
        out.flush().map_err(err_string)
    })
    .await
    .map_err(err_string)?
}

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
///
/// Без демона каждая команда держит `repo.lock`, пока работает, и две
/// одновременные (скажем, опрос статуса и «Перестать раздавать») мешают друг
/// другу. Такой отказ временный — команда повторяется.
async fn run_ipfs(paths: &IpfsPaths, args: &[&str]) -> Result<String, String> {
    const LOCK_RETRIES: u32 = 10;
    let mut attempt = 0;
    loop {
        match run_ipfs_once(paths, args).await {
            Err(e) if e.contains("someone else has the lock") && attempt < LOCK_RETRIES => {
                attempt += 1;
                tokio::time::sleep(Duration::from_millis(300)).await;
            }
            result => return result,
        }
    }
}

async fn run_ipfs_once(paths: &IpfsPaths, args: &[&str]) -> Result<String, String> {
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
    create_private(path)?.write_all(data)
}

/// Файл, который читает только владелец (0600 на unix): шифртекст, ключи.
fn create_private(path: &Path) -> std::io::Result<std::fs::File> {
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    opts.open(path)
}

/// Нативный диалог выбора файлов (main thread — внутри плагина). Пусто = отмена.
async fn pick_files(app: &AppHandle) -> Vec<PathBuf> {
    use tauri_plugin_dialog::DialogExt;
    let dialog = app.dialog().file();
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_files())
        .await
        .ok()
        .flatten()
        .unwrap_or_default();
    picked.into_iter().filter_map(|p| p.into_path().ok()).collect()
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
    fn save_target_decodes_the_path_and_rebuilds_the_url() {
        let t = SaveTarget::parse(
            "ipfs",
            "bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e",
            "docs/my%20file%E2%84%96.txt",
        )
        .unwrap();
        assert_eq!(t.segments, vec!["docs".to_string(), "my file№.txt".to_string()]);
        assert!(t.root_cid.is_some());
        assert_eq!(
            t.url("https://dweb.link").unwrap().as_str(),
            "https://dweb.link/ipfs/bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e/docs/my%20file%E2%84%96.txt"
        );
        let local = t.url("http://127.0.0.1:8080").unwrap();
        assert_eq!(local.host_str(), Some("127.0.0.1"));
        assert_eq!(local.port(), Some(8080));
    }

    #[test]
    fn save_target_rejects_path_tricks() {
        let cid = "bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e";
        for bad in ["..", "a/%2e%2e/b", "a%2Fb", "a%5Cb", "%zz", "%0a", "%ff"] {
            assert!(SaveTarget::parse("ipfs", cid, bad).is_err(), "{bad}");
        }
        assert!(SaveTarget::parse("ipfs", "../../api/v0/id", "").is_err());
        assert!(SaveTarget::parse("files", cid, "").is_err());
        // Лишние слэши — не ошибка, а пустые сегменты.
        assert_eq!(SaveTarget::parse("ipfs", cid, "/a//b/").unwrap().segments, vec!["a", "b"]);
    }

    #[test]
    fn save_target_accepts_ipns_names_without_verification() {
        let t = SaveTarget::parse("ipns", "en.wikipedia-on-ipfs.org", "wiki/Main_Page").unwrap();
        assert!(t.root_cid.is_none());
        assert_eq!(
            t.url("https://dweb.link").unwrap().as_str(),
            "https://dweb.link/ipns/en.wikipedia-on-ipfs.org/wiki/Main_Page"
        );
        assert!(SaveTarget::parse("ipns", "..evil", "").is_err());
        assert!(SaveTarget::parse("ipns", "a..b", "").is_err());
        assert!(SaveTarget::parse("ipns", "host/x", "").is_err());
    }

    /// С настоящим Kubo во временном repo без демона:
    /// `cargo test --lib ipfs::tests::with_kubo -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn with_kubo_a_private_file_round_trips_through_ipfs() {
        let kubo = ["/opt/homebrew/bin/ipfs", "/usr/local/bin/ipfs"]
            .into_iter()
            .map(PathBuf::from)
            .find(|p| p.exists())
            .expect("Kubo is not installed");
        let root = std::env::temp_dir().join(format!("bastyon-publish-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let mut paths = IpfsPaths::new(root.join("cache"), root.join("data").join("repo"));
        paths.binary = kubo;
        std::fs::create_dir_all(&paths.repo).unwrap();
        run_ipfs(&paths, &["init", "--profile=test"]).await.unwrap();

        let original: Vec<u8> = (0..300_000u32).map(|i| (i * 7 % 251) as u8).collect();
        let file = root.join("secret.bin");
        std::fs::write(&file, &original).unwrap();
        let (cid, key) = add_encrypted(&paths, &file).await.unwrap();

        // В IPFS лежит только шифртекст; ключ из ссылки возвращает оригинал.
        let out = tokio::process::Command::new(&paths.binary)
            .args(["cat", cid.trim()])
            .env("IPFS_PATH", &paths.repo)
            .output()
            .await
            .unwrap();
        assert_ne!(out.stdout, original);
        let mut plain = Vec::new();
        crypto::decrypt_stream(&key.unwrap(), &out.stdout[..], &mut plain, u64::MAX).unwrap();
        assert_eq!(plain, original);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn decrypt_file_reads_both_formats() {
        let dir = std::env::temp_dir().join(format!("bastyon-decrypt-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let plain: Vec<u8> = (0..5000u32).map(|i| (i % 251) as u8).collect();

        let mut sealed = Vec::new();
        let key_v2 = crypto::encrypt_stream(&plain[..], &mut sealed).unwrap();
        std::fs::write(dir.join("v2.enc"), &sealed).unwrap();
        decrypt_file(&key_v2, &dir.join("v2.enc"), &dir.join("v2.out")).unwrap();
        assert_eq!(std::fs::read(dir.join("v2.out")).unwrap(), plain);

        let (key_v1, blob) = crypto::encrypt(&plain).unwrap();
        std::fs::write(dir.join("v1.enc"), &blob).unwrap();
        decrypt_file(&key_v1, &dir.join("v1.enc"), &dir.join("v1.out")).unwrap();
        assert_eq!(std::fs::read(dir.join("v1.out")).unwrap(), plain);

        // Чужой ключ — ошибка, а не мусор на диске под именем файла.
        assert!(decrypt_file(&key_v1, &dir.join("v2.enc"), &dir.join("bad.out")).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Сервер, который отдаёт заголовки и первый мегабайт, а потом молчит.
    async fn stalling_server() -> String {
        use tokio::io::AsyncWriteExt;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/file", listener.local_addr().unwrap());
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0u8; 1024];
            let _ = tokio::io::AsyncReadExt::read(&mut socket, &mut request).await;
            let head = "HTTP/1.1 200 OK\r\nContent-Length: 10485760\r\n\r\n";
            socket.write_all(head.as_bytes()).await.unwrap();
            socket.write_all(&vec![7u8; 1 << 20]).await.unwrap();
            tokio::time::sleep(Duration::from_secs(30)).await;
        });
        url
    }

    #[tokio::test]
    async fn saving_reports_progress_and_stops_on_cancel() {
        let url = stalling_server().await;
        let (tx, cancel) = watch::channel(false);
        let seen = Arc::new(StdMutex::new(Vec::new()));
        let log = seen.clone();
        let job = SaveJob {
            report: Box::new(move |n| log.lock().unwrap().push(n)),
            cancel,
        };
        let part = TempFile::new("part");
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(400)).await;
            tx.send_replace(true);
        });
        let request = reqwest::Client::new().get(&url);
        let result = fetch_to_file(request, &part.0, None, Some(&job)).await;
        assert_eq!(result.unwrap_err(), SAVE_CANCELLED);
        // Прогресс шёл, пока сервер отдавал байты.
        assert!(seen.lock().unwrap().iter().any(|&n| n > 0 && n <= 1 << 20));
    }

    #[test]
    fn temp_files_never_share_a_name() {
        let files: Vec<TempFile> = (0..1000).map(|_| TempFile::new("car")).collect();
        let names: std::collections::HashSet<&PathBuf> = files.iter().map(|f| &f.0).collect();
        assert_eq!(names.len(), files.len());
    }

    #[test]
    fn part_file_sits_next_to_the_destination() {
        let dest = PathBuf::from("/Users/u/Downloads/photo.jpg");
        assert_eq!(part_path(&dest), PathBuf::from("/Users/u/Downloads/photo.jpg.part"));
    }

    /// Живая проверка против настоящего шлюза (нужна сеть):
    /// `cargo test --lib ipfs::tests::live_verified_download -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_verified_download_from_the_public_gateway() {
        // docs.ipfs.tech: images/welcome-to-IPFS.jpg — путь через два каталога.
        let t = SaveTarget::parse(
            "ipfs",
            "bafybeier6ud42ptljtfaxrdlknktw54b7ohfpg5h33mosxpxjndxs7xzvm",
            "images/welcome-to-IPFS.jpg",
        )
        .unwrap();
        let part = TempFile::new("jpg");
        save_verified(&t, t.root_cid.clone().unwrap(), &part.0, None).await.unwrap();
        let bytes = std::fs::read(&part.0).unwrap();
        assert_eq!(bytes.len(), 663_082);
        assert_eq!(&bytes[..3], &[0xff, 0xd8, 0xff]); // JPEG
    }

    /// То же через шардированные каталоги: `wiki/` зеркала Википедии — HAMT на
    /// миллионы записей, `Main_Page` — тоже HAMT (с index.html). Сеть нужна;
    /// корень — DNSLink en.wikipedia-on-ipfs.org.
    #[tokio::test]
    #[ignore]
    async fn live_verified_download_through_a_sharded_directory() {
        let t = SaveTarget::parse(
            "ipfs",
            "bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze",
            "wiki/Main_Page/index.html",
        )
        .unwrap();
        let part = TempFile::new("html");
        save_verified(&t, t.root_cid.clone().unwrap(), &part.0, None).await.unwrap();
        let html = std::fs::read_to_string(&part.0).unwrap();
        assert!(html.contains("Wikipedia"), "{}", &html[..html.len().min(200)]);
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
