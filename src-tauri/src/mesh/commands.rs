//! Команды mesh для интерфейса — те же, что были, пока радио и Reticulum
//! жили в приложении: имена, параметры и ответы прежние, их выполняет модуль
//! (crates/bastyon-mesh). События соединений и узла идут через `Channel`
//! команды — только окну, которое открыло соединение.
//!
//! Ошибки — строкой «код: подробности», код переводит интерфейс; без модуля —
//! `mesh_module_missing`.

use base64::Engine as _;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use super::host::SinkKind;
use super::MeshManager;

// ─── Радио: USB-serial, TCP, Bluetooth LE ──────────────────────────────────

/// Порты USB-serial системы.
#[tauri::command]
pub async fn radio_serial_ports(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call("radio_serial_ports", json!({})).await
}

/// Открыть порт из списка системы. Возвращает номер соединения.
#[tauri::command]
pub async fn radio_serial_open(
    mesh: State<'_, MeshManager>,
    path: String,
    baud: Option<u32>,
    on_event: Channel<Value>,
) -> Result<Value, String> {
    let args = json!({ "path": path, "baud": baud });
    mesh.call_with_sink("radio_serial_open", args, SinkKind::Radio, on_event)
        .await
}

/// Подключиться по TCP к радио в локальной сети.
#[tauri::command]
pub async fn radio_tcp_open(
    mesh: State<'_, MeshManager>,
    host: String,
    port: u16,
    on_event: Channel<Value>,
) -> Result<Value, String> {
    let args = json!({ "host": host, "port": port });
    mesh.call_with_sink("radio_tcp_open", args, SinkKind::Radio, on_event)
        .await
}

/// Записать байты в serial- или TCP-соединение.
#[tauri::command]
pub async fn radio_write(
    mesh: State<'_, MeshManager>,
    link: u32,
    data: Vec<u8>,
) -> Result<Value, String> {
    mesh.call("radio_write", json!({ "link": link, "data": data }))
        .await
}

/// Закрыть соединение. Модуль не запущен — закрывать нечего.
#[tauri::command]
pub async fn radio_close(mesh: State<'_, MeshManager>, link: u32) -> Result<Value, String> {
    mesh.call_if_running("radio_close", json!({ "link": link }))
        .await
        .unwrap_or(Ok(Value::Null))
}

/// Найти устройства BLE. `services` — UUID сервисов протокола; пусто — все
/// устройства с именем.
#[tauri::command]
pub async fn radio_ble_scan(
    mesh: State<'_, MeshManager>,
    services: Vec<String>,
    timeout_ms: Option<u32>,
) -> Result<Value, String> {
    let args = json!({ "services": services, "timeout_ms": timeout_ms });
    mesh.call("radio_ble_scan", args).await
}

/// Подключиться к устройству BLE из результатов сканирования.
#[tauri::command]
pub async fn radio_ble_connect(
    mesh: State<'_, MeshManager>,
    id: String,
    on_event: Channel<Value>,
) -> Result<Value, String> {
    mesh.call_with_sink(
        "radio_ble_connect",
        json!({ "id": id }),
        SinkKind::Radio,
        on_event,
    )
    .await
}

/// Включить уведомления характеристики.
#[tauri::command]
pub async fn radio_ble_subscribe(
    mesh: State<'_, MeshManager>,
    link: u32,
    characteristic: String,
) -> Result<Value, String> {
    let args = json!({ "link": link, "characteristic": characteristic });
    mesh.call("radio_ble_subscribe", args).await
}

/// Записать в характеристику.
#[tauri::command]
pub async fn radio_ble_write(
    mesh: State<'_, MeshManager>,
    link: u32,
    characteristic: String,
    data: Vec<u8>,
    with_response: Option<bool>,
) -> Result<Value, String> {
    let args = json!({
        "link": link,
        "characteristic": characteristic,
        "data": data,
        "with_response": with_response,
    });
    mesh.call("radio_ble_write", args).await
}

/// Прочитать характеристику.
#[tauri::command]
pub async fn radio_ble_read(
    mesh: State<'_, MeshManager>,
    link: u32,
    characteristic: String,
) -> Result<Value, String> {
    let args = json!({ "link": link, "characteristic": characteristic });
    mesh.call("radio_ble_read", args).await
}

// ─── Узел Reticulum: LXMF, NomadNet ────────────────────────────────────────

/// Поднять узел. Identity выведена из ключа аккаунта (src/mesh/reticulum).
/// Данные узла — в данных приложения, у каждого адреса свои.
#[tauri::command]
pub async fn rns_start(
    mesh: State<'_, MeshManager>,
    options: Value,
    on_event: Channel<Value>,
) -> Result<Value, String> {
    let args = json!({ "options": options, "base_dir": mesh.rns_dir() });
    mesh.call_with_sink("rns_start", args, SinkKind::Rns, on_event)
        .await
}

#[tauri::command]
pub async fn rns_stop(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call_if_running("rns_stop", json!({}))
        .await
        .unwrap_or(Ok(Value::Null))
}

/// Состояние узла. Модуль не запущен — узел остановлен; ради ответа модуль не
/// запускаем.
#[tauri::command]
pub async fn rns_status(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call_if_running("rns_status", json!({}))
        .await
        .unwrap_or_else(|| {
            Ok(json!({
                "running": false,
                "interfaces": [],
                "paths": 0,
                "propagationNode": null,
            }))
        })
}

#[tauri::command]
pub async fn rns_announce(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call("rns_announce", json!({})).await
}

/// Обзор сети: таблица путей узла.
#[tauri::command]
pub async fn rns_paths(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call("rns_paths", json!({})).await
}

#[tauri::command]
pub async fn rns_send(
    mesh: State<'_, MeshManager>,
    to: String,
    content: String,
    title: String,
    method: Value,
    attachments: Option<Value>,
    custom: Option<Value>,
) -> Result<Value, String> {
    let args = json!({
        "to": to,
        "content": content,
        "title": title,
        "method": method,
        "attachments": attachments,
        "custom": custom,
    });
    mesh.call("rns_send", args).await
}

/// Запомнить ключ адресата из проверенной записи связки: писать ему можно до
/// его announce.
#[tauri::command]
pub async fn rns_learn(
    mesh: State<'_, MeshManager>,
    dest: String,
    key: String,
) -> Result<Value, String> {
    mesh.call("rns_learn", json!({ "dest": dest, "key": key }))
        .await
}

/// Бумажное сообщение адресату: ссылка `lxm://` (для QR или текста).
#[tauri::command]
pub async fn rns_paper(
    mesh: State<'_, MeshManager>,
    to: String,
    content: String,
) -> Result<Value, String> {
    mesh.call("rns_paper", json!({ "to": to, "content": content }))
        .await
}

/// Открыть бумажное сообщение: придёт событием `message`.
#[tauri::command]
pub async fn rns_ingest(mesh: State<'_, MeshManager>, uri: String) -> Result<Value, String> {
    mesh.call("rns_ingest", json!({ "uri": uri })).await
}

#[tauri::command]
pub async fn rns_request_path(mesh: State<'_, MeshManager>, to: String) -> Result<Value, String> {
    mesh.call("rns_request_path", json!({ "to": to })).await
}

#[tauri::command]
pub async fn rns_set_propagation_node(
    mesh: State<'_, MeshManager>,
    hash: Option<String>,
) -> Result<Value, String> {
    mesh.call("rns_set_propagation_node", json!({ "hash": hash }))
        .await
}

#[tauri::command]
pub async fn rns_sync(mesh: State<'_, MeshManager>) -> Result<Value, String> {
    mesh.call("rns_sync", json!({})).await
}

/// Страница узла NomadNet.
#[tauri::command]
pub async fn rns_page(
    mesh: State<'_, MeshManager>,
    node: String,
    path: String,
    data: HashMap<String, String>,
) -> Result<Value, String> {
    mesh.call(
        "rns_page",
        json!({ "node": node, "path": path, "data": data }),
    )
    .await
}

/// Файл узла NomadNet (`/file/…`): модуль его скачивает, приложение сохраняет
/// через системный диалог. Имя пришло от узла — недоверенное: в диалог идёт
/// только basename. Узел может ответить страницей (отказ) — она возвращается
/// для показа.
#[tauri::command]
pub async fn rns_download(
    app: AppHandle,
    mesh: State<'_, MeshManager>,
    node: String,
    path: String,
) -> Result<Value, String> {
    let got = mesh
        .call("rns_download", json!({ "node": node, "path": path }))
        .await?;
    if got["kind"] != "file" {
        return Ok(got);
    }
    let name = got["name"].as_str().unwrap_or_default();
    let data = base64::engine::general_purpose::STANDARD
        .decode(got["data"].as_str().unwrap_or_default())
        .map_err(|e| format!("rns_error: {e}"))?;
    let suggested = crate::ipfs::safe_basename(name, "nomadnet");
    let Some(target) = crate::ipfs::save_file(&app, &suggested).await else {
        return Ok(json!({ "kind": "cancelled" }));
    };
    std::fs::write(&target, &data).map_err(|e| format!("rns_error: {e}"))?;
    Ok(json!({ "kind": "saved", "name": suggested, "size": data.len() }))
}
