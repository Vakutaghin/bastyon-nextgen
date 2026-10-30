//! Tor на компьютере: команды Tauri над общим крейтом `bastyon-tor` и
//! скачивание бандла (`installer`). Логика Tor — в крейте, тот же код
//! работает на Android (bastyon-tor-jni).

pub mod installer;

pub use bastyon_tor::{
    process, state, ws, BundleError, Emitter, Host, TorBridgesPayload, TorBridgesResult,
    TorFetchRequest, TorFetchResponse, TorManager, TorRequestedBridges, WsSendPayload,
    TOR_NOT_READY,
};

use crate::tor::installer::InstallError;
use crate::tor::state::{TorPaths, TorStateSnapshot, TorStatus};
use futures_util::future::BoxFuture;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter as _, Manager, State};

/// События Tor — событиями Tauri.
pub fn emitter(app: &AppHandle) -> Emitter {
    let app = app.clone();
    Arc::new(move |event: &str, payload: serde_json::Value| {
        let _ = app.emit(event, payload);
    })
}

/// Идёт фоновая загрузка новой версии бандла (`upgrade_in_background`).
static UPGRADING: AtomicBool = AtomicBool::new(false);

struct DesktopHost {
    app: AppHandle,
}

impl From<InstallError> for BundleError {
    fn from(e: InstallError) -> Self {
        match e {
            InstallError::Cancelled => BundleError::Cancelled,
            other => BundleError::Failed(other.to_string()),
        }
    }
}

impl Host for DesktopHost {
    fn ensure_bundle<'a>(
        &'a self,
        paths: &'a TorPaths,
        cancel: &'a AtomicBool,
    ) -> BoxFuture<'a, Result<(), BundleError>> {
        Box::pin(async move {
            installer::ensure_installed(&self.app, paths, cancel)
                .await
                .map_err(BundleError::from)
        })
    }

    /// С Tor мимо него ничего не идёт: прямые сокеты к нодам закрываем.
    fn before_start(&self) -> BoxFuture<'_, ()> {
        Box::pin(crate::node_link::close_all())
    }

    fn after_supervise(&self, mgr: TorManager) -> BoxFuture<'static, ()> {
        Box::pin(async move { upgrade_in_background(&mgr).await })
    }
}

#[tauri::command]
pub async fn tor_status(mgr: State<'_, TorManager>) -> Result<TorStateSnapshot, String> {
    Ok(mgr.status().await)
}

/// Скачан ли Tor — для настроек → «Модули» (`tor_status` о файлах молчит).
#[tauri::command]
pub fn tor_installed(mgr: State<'_, TorManager>) -> bool {
    installer::has_bundle(&mgr.paths)
}

/// Версия для вкладки «Модули». Новый бандл скачивается через сам Tor и
/// встаёт при следующем включении (`installer::download_upgrade`).
pub fn module_version(mgr: &TorManager) -> Option<crate::storage::ModuleVersion> {
    let installed = installer::installed_version(&mgr.paths)?;
    Some(crate::storage::ModuleVersion::new(
        &installed,
        installer::tor_version(),
        installer::upgrade_pending(&mgr.paths),
    ))
}

/// «Удалить» в настройках → «Модули»: бандл и кэш каталога узлов. Только у
/// выключенного Tor — файлы работающего не удалить (на Windows — вообще).
/// Мосты остаются в состоянии и в настройках; Tor скачается снова, когда его
/// включат.
#[tauri::command]
pub async fn tor_uninstall(mgr: State<'_, TorManager>) -> Result<(), String> {
    let _install = mgr.install_lock.lock().await;
    let status = mgr.state.read().await.status;
    let alive = mgr.child.lock().expect("tor child mutex poisoned").is_some();
    if alive || !matches!(status, TorStatus::Off | TorStatus::Failed) {
        return Err("tor_running".into());
    }
    let root = &mgr.paths.root;
    if root.exists() {
        std::fs::remove_dir_all(root).map_err(|e| format!("remove_failed: {e}"))?;
    }
    std::fs::create_dir_all(root).map_err(|e| format!("remove_failed: {e}"))
}

/// Сохраняет выбор мостов; применяется при следующем `tor_start`.
#[tauri::command]
pub async fn tor_set_bridges(
    payload: TorBridgesPayload,
    mgr: State<'_, TorManager>,
) -> Result<TorBridgesResult, String> {
    Ok(mgr.set_bridges(payload).await)
}

/// «Получить мосты»: Moat запускает lyrebird из бандла.
#[tauri::command]
pub async fn tor_request_bridges(
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<TorRequestedBridges, String> {
    // Мостам хватит и бандла прежней версии. Новую ставит только запуск Tor:
    // файлы работающего tor не заменить.
    if !installer::has_bundle(&mgr.paths) {
        let _install = mgr.install_lock.lock().await;
        installer::ensure_installed(&app, &mgr.paths, &AtomicBool::new(false))
            .await
            .map_err(|e| e.to_string())?;
    }
    mgr.request_bridges().await
}

#[tauri::command]
pub async fn tor_start(mgr: State<'_, TorManager>) -> Result<TorStateSnapshot, String> {
    mgr.start().await
}

/// Tor подключился на бандле прежней версии: приложение обновилось и закрепило
/// новый Tor. Скачиваем его через подключённый — встанет при следующем
/// включении. Не скачался — попробуем при следующем подключении.
async fn upgrade_in_background(mgr: &TorManager) {
    if !installer::upgrade_pending(&mgr.paths) || UPGRADING.swap(true, Ordering::SeqCst) {
        return;
    }
    let result = match upgrade_client(mgr).await {
        Ok(client) => installer::download_upgrade(&client, &mgr.paths)
            .await
            .map_err(|e| e.to_string()),
        Err(e) => Err(e),
    };
    UPGRADING.store(false, Ordering::SeqCst);
    match result {
        Ok(()) => log::info!(
            "[tor] Tor {} downloaded, installs on the next start",
            installer::tor_version()
        ),
        Err(e) => log::warn!(
            "[tor] Tor {} not downloaded: {}",
            installer::tor_version(),
            e
        ),
    }
}

/// Только через Tor (fail-closed) и без общего таймаута: бандл в десятки
/// мегабайт через Tor качается дольше двух минут клиентов `tor_fetch`.
async fn upgrade_client(mgr: &TorManager) -> Result<reqwest::Client, String> {
    let st = mgr.state.read().await;
    if st.status != TorStatus::Ready {
        return Err(format!("{}: status={:?}", TOR_NOT_READY, st.status));
    }
    let proxy = reqwest::Proxy::all(format!("socks5h://127.0.0.1:{}", st.socks_port))
        .map_err(|e| e.to_string())?;
    reqwest::Client::builder()
        .proxy(proxy)
        .user_agent("Bastyon/1.0")
        .connect_timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())
}

/// `restart` — перезапуск с новыми мостами: Tor остаётся включённым, и
/// прямые соединения между остановкой и `tor_start` по-прежнему закрыты.
#[tauri::command]
pub async fn tor_stop(
    mgr: State<'_, TorManager>,
    restart: Option<bool>,
) -> Result<TorStateSnapshot, String> {
    Ok(mgr.stop(restart == Some(true)).await)
}

#[tauri::command]
pub async fn tor_fetch(
    req: TorFetchRequest,
    mgr: State<'_, TorManager>,
) -> Result<TorFetchResponse, String> {
    mgr.fetch(req).await
}

/// `id` генерирует JS и подписывается на события ДО invoke — иначе `open`
/// и первые сообщения терялись (Tauri не буферизует события, V22).
#[tauri::command]
pub async fn tor_ws_connect(
    id: String,
    url: String,
    mgr: State<'_, TorManager>,
) -> Result<(), String> {
    mgr.ws_connect(id, url).await
}

#[tauri::command]
pub async fn tor_ws_send(
    id: String,
    payload: WsSendPayload,
    mgr: State<'_, TorManager>,
) -> Result<(), String> {
    mgr.ws_send(&id, payload).await
}

#[tauri::command]
pub async fn tor_ws_close(id: String, mgr: State<'_, TorManager>) -> Result<(), String> {
    mgr.ws_close(&id).await
}

/// Initialize the manager and stash it in app state.
/// Called once from Tauri setup.
pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?;
    let root = app_data.join("tor");
    std::fs::create_dir_all(&root)?;
    let paths = TorPaths::from_root(root);
    let host = DesktopHost { app: app.clone() };
    let manager = TorManager::new(paths, emitter(app), Arc::new(host));
    app.manage(manager);
    Ok(())
}
