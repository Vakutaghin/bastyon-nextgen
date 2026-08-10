pub mod config;
pub mod crypto;
pub mod installer;
pub mod process;
pub mod state;

use crate::ipfs::process::IpfsChild;
use crate::ipfs::state::{IpfsPaths, IpfsState, IpfsStateSnapshot, IpfsStatus, SharedIpfsState};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

pub struct IpfsManager {
    pub state: SharedIpfsState,
    pub paths: IpfsPaths,
    /// Держится синхронно; kill в обработчике выхода не требует tokio-рантайма.
    pub child: StdMutex<Option<IpfsChild>>,
    /// Сериализует ensure/start: параллельные клики по IPFS-ссылкам не должны
    /// поднимать два демона на один repo (второй упрётся в repo.lock).
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

#[tauri::command]
pub async fn ipfs_status(mgr: State<'_, IpfsManager>) -> Result<IpfsStateSnapshot, String> {
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
    // Быстрый путь без блокировки.
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
        }
        mgr.emit_state(&app).await;
        return Ok(mgr.state.read().await.snapshot());
    }

    // 2. Установка бинаря.
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Installing;
        st.message = Some("Preparing IPFS".into());
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

    // 4. Конфигурация ноды-читателя (порты /tcp/0, autoclient, Provide off, CORS).
    for args in config::config_commands() {
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
    match wait_ready(&mgr.paths, config::DAEMON_READY_TIMEOUT_SECS).await {
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
    // Пробуем graceful shutdown через API, затем добиваем процесс.
    let api_port = mgr.state.read().await.api_port;
    if api_port != 0 {
        let _ = reqwest::Client::new()
            .post(format!("http://127.0.0.1:{api_port}/api/v0/shutdown"))
            .send()
            .await;
    }
    {
        let mut guard = mgr.child.lock().expect("ipfs child mutex poisoned");
        if let Some(mut c) = guard.take() {
            let _ = process::kill(&mut c);
        }
    }
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Off;
        st.message = None;
        st.child_pid = None;
        st.gateway_port = 0;
        st.api_port = 0;
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn ipfs_uninstall(
    app: AppHandle,
    mgr: State<'_, IpfsManager>,
) -> Result<IpfsStateSnapshot, String> {
    {
        let mut guard = mgr.child.lock().expect("ipfs child mutex poisoned");
        if let Some(mut c) = guard.take() {
            let _ = process::kill(&mut c);
        }
    }
    // Освобождаем диск: и бинарь, и repo (кэш блоков может быть крупным).
    let _ = std::fs::remove_dir_all(&mgr.paths.bin_dir);
    let _ = std::fs::remove_dir_all(&mgr.paths.repo);
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
    {
        let mut guard = mgr.child.lock().expect("ipfs child mutex poisoned");
        if let Some(mut c) = guard.take() {
            let _ = process::kill(&mut c);
        }
    }
    let _ = std::fs::remove_dir_all(&mgr.paths.bin_dir);
    {
        let mut st = mgr.state.write().await;
        st.status = IpfsStatus::Off;
        st.installed = false;
        st.update_available = false;
        st.gateway_port = 0;
        st.api_port = 0;
        st.child_pid = None;
        st.message = None;
    }
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

/// Публикация файла в IPFS (write-сторона / файлообменник). Нода должна быть
/// поднята — гейтится на фронте через ensureRunning. `add` пинит локально по
/// умолчанию (контент жив, пока эта нода онлайн и достижима). Возвращает CID.
///
/// ВАЖНО: контент ПУБЛИЧНЫЙ — любой с этим CID скачает его. Приватные файлы
/// нужно шифровать на клиенте ДО публикации (см. дизайн-док §5, отдельный этап).
#[tauri::command]
pub async fn ipfs_add(path: String, mgr: State<'_, IpfsManager>) -> Result<String, String> {
    let cid = run_ipfs(
        &mgr.paths,
        &["add", "-Q", "--cid-version=1", "--pin=true", &path],
    )
    .await?;
    let cid = cid.trim().to_string();
    if cid.is_empty() {
        return Err("ipfs add returned empty CID".into());
    }
    Ok(cid)
}

#[derive(serde::Serialize)]
pub struct EncryptedAddResult {
    pub cid: String,
    pub key: String,
}

/// Приватная публикация: шифруем файл случайным ключом (AES-256-GCM) и кладём
/// ШИФРТЕКСТ в IPFS. Ключ возвращаем — он поедет во фрагменте ссылки, не на
/// gateway. Публичным остаётся лишь непонятный блоб.
#[tauri::command]
pub async fn ipfs_add_encrypted(
    path: String,
    mgr: State<'_, IpfsManager>,
) -> Result<EncryptedAddResult, String> {
    let plaintext = std::fs::read(&path).map_err(err_string)?;
    let (key, blob) = crypto::encrypt(&plaintext).map_err(err_string)?;

    // Временный файл под шифртекст (ipfs add берёт путь).
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("bastyon-ipfs-{}-{}.enc", std::process::id(), stamp));
    std::fs::write(&tmp, &blob).map_err(err_string)?;

    let add = run_ipfs(
        &mgr.paths,
        &[
            "add",
            "-Q",
            "--cid-version=1",
            "--pin=true",
            &tmp.to_string_lossy(),
        ],
    )
    .await;
    let _ = std::fs::remove_file(&tmp);

    let cid = add?.trim().to_string();
    if cid.is_empty() {
        return Err("ipfs add returned empty CID".into());
    }
    Ok(EncryptedAddResult { cid, key })
}

/// Открытие приватного файла: тянем ШИФРТЕКСТ с gateway, расшифровываем ключом из
/// ссылки и пишем расшифрованное на диск (`dest`). gateway резолвит фронт (Tier1/0
/// + Tor-guard), сюда приходит уже выбранный базовый URL.
#[tauri::command]
pub async fn ipfs_save_encrypted(
    gateway: String,
    cid: String,
    key: String,
    dest: String,
) -> Result<(), String> {
    let url = format!("{}/ipfs/{}", gateway.trim_end_matches('/'), cid);
    // Таймаут: на «холодном» CID нода может не отдать блоки — не висим вечно.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(err_string)?;
    let bytes = client
        .get(&url)
        .send()
        .await
        .map_err(err_string)?
        .error_for_status()
        .map_err(err_string)?
        .bytes()
        .await
        .map_err(err_string)?;
    let plain = crypto::decrypt(&key, &bytes).map_err(err_string)?;
    std::fs::write(&dest, plain).map_err(err_string)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Удалённый pin (Ф5c) — durability через IPFS Pinning Service API.
// Сервис (endpoint+token) хранит сам Kubo в своём конфиге. Работает со сторонним
// провайдером (Pinata/web3.storage) или ipfs-cluster на своём VPS.
// ---------------------------------------------------------------------------

/// Задать/пересоздать удалённый pinning-сервис (идемпотентно: rm + add).
#[tauri::command]
pub async fn ipfs_pin_service_set(
    endpoint: String,
    key: String,
    mgr: State<'_, IpfsManager>,
) -> Result<(), String> {
    let _ = run_ipfs(
        &mgr.paths,
        &["pin", "remote", "service", "rm", config::REMOTE_PIN_SERVICE],
    )
    .await;
    run_ipfs(
        &mgr.paths,
        &[
            "pin",
            "remote",
            "service",
            "add",
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
        &["pin", "remote", "service", "rm", config::REMOTE_PIN_SERVICE],
    )
    .await;
    Ok(())
}

/// Запинить CID на удалённом сервисе (в фоне). Best-effort: без сервиса вернёт Err.
#[tauri::command]
pub async fn ipfs_pin_remote(cid: String, mgr: State<'_, IpfsManager>) -> Result<(), String> {
    run_ipfs(
        &mgr.paths,
        &[
            "pin",
            "remote",
            "add",
            &format!("--service={}", config::REMOTE_PIN_SERVICE),
            "--background",
            &cid,
        ],
    )
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Внутреннее
// ---------------------------------------------------------------------------

/// Короткоживущий вызов `ipfs <args>` с нашим IPFS_PATH. Ошибка → stderr текстом.
async fn run_ipfs(paths: &IpfsPaths, args: &[&str]) -> Result<String, String> {
    let out = tokio::process::Command::new(&paths.binary)
        .args(args)
        .env("IPFS_PATH", &paths.repo)
        .env("IPFS_TELEMETRY", "off")
        .output()
        .await
        .map_err(err_string)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn read_api_port(paths: &IpfsPaths) -> Option<u16> {
    let raw = std::fs::read_to_string(paths.repo.join(config::IPFS_API_FILE)).ok()?;
    config::parse_api_multiaddr(&raw)
}

fn read_gateway_port(paths: &IpfsPaths) -> Option<u16> {
    let raw = std::fs::read_to_string(paths.repo.join(config::IPFS_GATEWAY_FILE)).ok()?;
    config::parse_gateway_url(&raw)
}

/// Живой демон пишет свой адрес в `$IPFS_PATH/api`. Файл мог остаться и от
/// мёртвого процесса — проверяем не наличие, а ответ API.
async fn try_attach(paths: &IpfsPaths) -> Option<(u16, u16)> {
    let api_port = read_api_port(paths)?;
    let alive = reqwest::Client::new()
        .post(format!("http://127.0.0.1:{api_port}/api/v0/id"))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    if !alive {
        return None;
    }
    let gw_port = read_gateway_port(paths)?;
    Some((api_port, gw_port))
}

/// Демон поднимается не мгновенно. Готовность = файлы api/gateway записаны
/// (значит слушатели живы) И API отвечает. Возвращает (api_port, gateway_port).
async fn wait_ready(paths: &IpfsPaths, timeout_secs: u64) -> Option<(u16, u16)> {
    let client = reqwest::Client::new();
    for _ in 0..(timeout_secs * 2) {
        if let Some(api_port) = read_api_port(paths) {
            let alive = client
                .post(format!("http://127.0.0.1:{api_port}/api/v0/id"))
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if alive {
                if let Some(gw_port) = read_gateway_port(paths) {
                    return Some((api_port, gw_port));
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    None
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
