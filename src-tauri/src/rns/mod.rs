//! Узел Reticulum прямо в приложении: rns-net (стек, интерфейсы) и lxmf-rs
//! (сообщения LXMF, узлы доставки). Identity приходит из интерфейса — она
//! выведена из ключа аккаунта (src/mesh/reticulum/identity.ts), поэтому
//! мнемоника восстанавливает и адрес Reticulum.
//!
//! Стек работает на своих потоках (без tokio); события — announce,
//! сообщения, их судьба, интерфейсы — идут через `Channel` команды `rns_start`
//! только окну, которое его запустило.
//!
//! Ошибки — строкой «код: подробности», код переводит интерфейс.
//!
//! Сам узел — в крейте bastyon-rns (общий с Android). rns-net собирается
//! только под unix; на Windows команды есть, но отвечают `unsupported`.

use bastyon_rns::{node, types};

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

use types::{Attachment, Method, Page, RnsEvent, StartOptions, Started, Status};

/// Один узел на приложение; `None` — остановлен.
#[derive(Default)]
pub struct RnsManager {
    node: Mutex<Option<node::Runtime>>,
}

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    app.manage(RnsManager::default());
    Ok(())
}

/// Каталог данных узла: таблица путей, известные identity, очередь LXMF.
/// У каждого адреса — свой, чтобы аккаунты не видели чужое.
fn data_dir(app: &AppHandle, identity_hash: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())
        .map_err(|e| format!("rns_error: {e}"))?;
    Ok(base.join("reticulum").join(identity_hash))
}

fn with_node<T>(
    state: &State<'_, RnsManager>,
    run: impl FnOnce(&node::Runtime) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state.node.lock().map_err(|_| "rns_error: lock".to_string())?;
    match guard.as_ref() {
        Some(node) => run(node),
        None => Err("rns_not_running".to_string()),
    }
}

#[tauri::command]
pub async fn rns_start(
    app: AppHandle,
    state: State<'_, RnsManager>,
    options: StartOptions,
    on_event: Channel<RnsEvent>,
) -> Result<Started, String> {
    if options.identity.len() != 64 {
        return Err("rns_error: identity must be 64 bytes".into());
    }
    // Прежний узел (другой аккаунт, новые настройки) — остановить и дождаться:
    // новый займёт те же порты LAN и тот же RNode.
    let old = state.node.lock().map_err(|_| "rns_error: lock")?.take();
    if let Some(old) = old {
        tauri::async_runtime::spawn_blocking(move || old.stop())
            .await
            .map_err(|e| format!("rns_error: {e}"))?;
    }
    let identity_hash = node::identity_hash(&options.identity)?;
    let dir = data_dir(&app, &identity_hash)?;
    let sink = move |ev: RnsEvent| {
        let _ = on_event.send(ev);
    };
    let runtime = tauri::async_runtime::spawn_blocking(move || node::Runtime::start(options, dir, sink))
        .await
        .map_err(|e| format!("rns_error: {e}"))??;
    let started = runtime.started();
    *state.node.lock().map_err(|_| "rns_error: lock")? = Some(runtime);
    Ok(started)
}

#[tauri::command]
pub async fn rns_stop(state: State<'_, RnsManager>) -> Result<(), String> {
    let node = state.node.lock().map_err(|_| "rns_error: lock")?.take();
    if let Some(node) = node {
        tauri::async_runtime::spawn_blocking(move || node.stop())
            .await
            .map_err(|e| format!("rns_error: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn rns_status(state: State<'_, RnsManager>) -> Result<Status, String> {
    let guard = state.node.lock().map_err(|_| "rns_error: lock".to_string())?;
    Ok(match guard.as_ref() {
        Some(node) => node.status(),
        None => Status {
            running: false,
            interfaces: vec![],
            paths: 0,
            propagation_node: None,
        },
    })
}

#[tauri::command]
pub fn rns_announce(state: State<'_, RnsManager>) -> Result<(), String> {
    with_node(&state, |n| n.announce())
}

#[tauri::command]
pub fn rns_send(
    state: State<'_, RnsManager>,
    to: String,
    content: String,
    title: String,
    method: Method,
    attachments: Option<Vec<Attachment>>,
) -> Result<serde_json::Value, String> {
    let dest = types::parse_hash::<16>(&to)?;
    let attachments = attachments.unwrap_or_default();
    let id = with_node(&state, |n| n.send(dest, &title, &content, &attachments, method))?;
    Ok(serde_json::json!({ "id": id }))
}

/// Бумажное сообщение адресату: ссылка `lxm://` (для QR или текста).
#[tauri::command]
pub fn rns_paper(
    state: State<'_, RnsManager>,
    to: String,
    content: String,
) -> Result<serde_json::Value, String> {
    let dest = types::parse_hash::<16>(&to)?;
    let uri = with_node(&state, |n| n.paper(dest, &content))?;
    Ok(serde_json::json!({ "uri": uri }))
}

/// Открыть бумажное сообщение: придёт событием `message`.
#[tauri::command]
pub fn rns_ingest(state: State<'_, RnsManager>, uri: String) -> Result<(), String> {
    with_node(&state, |n| n.ingest(&uri))
}

#[tauri::command]
pub fn rns_request_path(state: State<'_, RnsManager>, to: String) -> Result<(), String> {
    let dest = types::parse_hash::<16>(&to)?;
    with_node(&state, |n| n.request_path(dest))
}

#[tauri::command]
pub fn rns_set_propagation_node(
    state: State<'_, RnsManager>,
    hash: Option<String>,
) -> Result<(), String> {
    let node_hash = match hash {
        Some(h) => Some(types::parse_hash::<16>(&h)?),
        None => None,
    };
    with_node(&state, |n| n.set_propagation_node(node_hash))
}

#[tauri::command]
pub fn rns_sync(state: State<'_, RnsManager>) -> Result<(), String> {
    with_node(&state, |n| n.sync())
}

#[tauri::command]
pub async fn rns_page(
    state: State<'_, RnsManager>,
    node: String,
    path: String,
    data: std::collections::HashMap<String, String>,
) -> Result<Page, String> {
    let dest = types::parse_hash::<16>(&node)?;
    // Запрос страницы идёт через Link и может ждать десятки секунд — не в
    // потоке команд.
    let handle = {
        let guard = state.node.lock().map_err(|_| "rns_error: lock".to_string())?;
        guard.as_ref().ok_or("rns_not_running")?.handle()
    };
    tauri::async_runtime::spawn_blocking(move || handle.page(dest, &path, &data))
        .await
        .map_err(|e| format!("rns_error: {e}"))?
}

/// При выходе из приложения остановить узел (закрыть интерфейсы, сохранить пути).
pub fn shutdown_on_exit(mgr: &RnsManager) {
    if let Ok(mut guard) = mgr.node.lock() {
        if let Some(node) = guard.take() {
            node.stop();
        }
    }
}
