//! Модуль mesh-сетей приложения Bastyon на компьютере.
//!
//! Отдельная программа, как Tor и Kubo: приложение скачивает её, когда человек
//! попросит, запускает, когда mesh нужен, и разговаривает с ней строками JSON
//! через stdin и stdout (wire.rs). Внутри — радио-слой (USB-serial, TCP,
//! Bluetooth LE) и узел Reticulum (bastyon-rns). Протоколы MeshCore и
//! Meshtastic живут в интерфейсе приложения, сюда приходят только байты.
//!
//! Команды и их ответы — те же, что у прежних команд Tauri `radio_*` и
//! `rns_*`: приложение передаёт их как есть. stdin закрылся — приложения
//! больше нет: модуль отпускает радио, сохраняет узел и выходит. Журнал — в
//! stderr, его пишет журнал приложения.

pub mod radio;
pub mod rns;
pub mod wire;

use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;

/// Сколько доделывать начатые команды, когда приложение закрыло stdin.
const FINISH_ON_EXIT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Default)]
struct Mesh {
    radio: radio::RadioManager,
    rns: rns::RnsManager,
}

/// Журнал в stderr: строку целиком читает приложение.
struct StderrLog;

impl log::Log for StderrLog {
    fn enabled(&self, meta: &log::Metadata) -> bool {
        meta.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            eprintln!("{} {}: {}", record.level(), record.target(), record.args());
        }
    }

    fn flush(&self) {}
}

fn args<T: DeserializeOwned>(args: Value) -> Result<T, String> {
    serde_json::from_value(args).map_err(|e| format!("bad_args: {e}"))
}

fn to_value<T: serde::Serialize>(v: T) -> Result<Value, String> {
    serde_json::to_value(v).map_err(|e| format!("bad_result: {e}"))
}

fn radio_sink(id: u64) -> radio::EventSink {
    let sink = wire::Sink::new(id);
    Arc::new(move |ev| sink.send(&ev))
}

#[derive(Deserialize)]
struct SerialOpen {
    path: String,
    baud: Option<u32>,
    sink: u64,
}

#[derive(Deserialize)]
struct TcpOpen {
    host: String,
    port: u16,
    sink: u64,
}

#[derive(Deserialize)]
struct LinkData {
    link: u32,
    data: Vec<u8>,
}

#[derive(Deserialize)]
struct LinkOnly {
    link: u32,
}

#[derive(Deserialize)]
struct BleScan {
    services: Vec<String>,
    timeout_ms: Option<u32>,
}

#[derive(Deserialize)]
struct BleConnect {
    id: String,
    sink: u64,
}

#[derive(Deserialize)]
struct BleChar {
    link: u32,
    characteristic: String,
}

#[derive(Deserialize)]
struct BleWrite {
    link: u32,
    characteristic: String,
    data: Vec<u8>,
    with_response: Option<bool>,
}

#[derive(Deserialize)]
struct RnsStart {
    options: bastyon_rns::types::StartOptions,
    base_dir: PathBuf,
    sink: u64,
}

#[derive(Deserialize)]
struct RnsSend {
    to: String,
    content: String,
    title: String,
    method: bastyon_rns::types::Method,
    attachments: Option<Vec<bastyon_rns::types::Attachment>>,
    custom: Option<bastyon_rns::types::Custom>,
}

#[derive(Deserialize)]
struct Learn {
    dest: String,
    key: String,
}

#[derive(Deserialize)]
struct Paper {
    to: String,
    content: String,
}

#[derive(Deserialize)]
struct Uri {
    uri: String,
}

#[derive(Deserialize)]
struct To {
    to: String,
}

#[derive(Deserialize)]
struct PropagationNode {
    hash: Option<String>,
}

#[derive(Deserialize)]
struct NomadPage {
    node: String,
    path: String,
    #[serde(default)]
    data: HashMap<String, String>,
}

#[derive(Deserialize)]
struct NomadDownload {
    node: String,
    path: String,
}

async fn handle(mesh: &Mesh, cmd: &str, a: Value) -> Result<Value, String> {
    let ok = |_: ()| Value::Null;
    match cmd {
        "radio_serial_ports" => to_value(mesh.radio.serial_ports().await?),
        "radio_serial_open" => {
            let a: SerialOpen = args(a)?;
            to_value(
                mesh.radio
                    .serial_open(a.path, a.baud, radio_sink(a.sink))
                    .await?,
            )
        }
        "radio_tcp_open" => {
            let a: TcpOpen = args(a)?;
            to_value(
                mesh.radio
                    .tcp_open(a.host, a.port, radio_sink(a.sink))
                    .await?,
            )
        }
        "radio_write" => {
            let a: LinkData = args(a)?;
            mesh.radio.write(a.link, a.data).await.map(ok)
        }
        "radio_close" => {
            let a: LinkOnly = args(a)?;
            mesh.radio.close(a.link).await;
            Ok(Value::Null)
        }
        "radio_ble_scan" => {
            let a: BleScan = args(a)?;
            to_value(mesh.radio.ble_scan(a.services, a.timeout_ms).await?)
        }
        "radio_ble_connect" => {
            let a: BleConnect = args(a)?;
            to_value(mesh.radio.ble_connect(a.id, radio_sink(a.sink)).await?)
        }
        "radio_ble_subscribe" => {
            let a: BleChar = args(a)?;
            mesh.radio
                .ble_subscribe(a.link, a.characteristic)
                .await
                .map(ok)
        }
        "radio_ble_write" => {
            let a: BleWrite = args(a)?;
            mesh.radio
                .ble_write(a.link, a.characteristic, a.data, a.with_response)
                .await
                .map(ok)
        }
        "radio_ble_read" => {
            let a: BleChar = args(a)?;
            to_value(mesh.radio.ble_read(a.link, a.characteristic).await?)
        }
        "rns_start" => {
            let a: RnsStart = args(a)?;
            let sink = wire::Sink::new(a.sink);
            let started = mesh
                .rns
                .start(a.options, a.base_dir, move |ev| sink.send(&ev))
                .await?;
            to_value(started)
        }
        "rns_stop" => mesh.rns.stop().await.map(ok),
        "rns_status" => to_value(mesh.rns.status()?),
        "rns_announce" => mesh.rns.announce().map(ok),
        "rns_paths" => to_value(mesh.rns.paths()?),
        "rns_send" => {
            let a: RnsSend = args(a)?;
            mesh.rns.send(
                &a.to,
                &a.content,
                &a.title,
                a.method,
                a.attachments.unwrap_or_default(),
                a.custom,
            )
        }
        "rns_learn" => {
            let a: Learn = args(a)?;
            mesh.rns.learn(&a.dest, &a.key).map(ok)
        }
        "rns_paper" => {
            let a: Paper = args(a)?;
            mesh.rns.paper(&a.to, &a.content)
        }
        "rns_ingest" => {
            let a: Uri = args(a)?;
            mesh.rns.ingest(&a.uri).map(ok)
        }
        "rns_request_path" => {
            let a: To = args(a)?;
            mesh.rns.request_path(&a.to).map(ok)
        }
        "rns_set_propagation_node" => {
            let a: PropagationNode = args(a)?;
            mesh.rns.set_propagation_node(a.hash.as_deref()).map(ok)
        }
        "rns_sync" => mesh.rns.sync().map(ok),
        "rns_page" => {
            let a: NomadPage = args(a)?;
            to_value(mesh.rns.page(&a.node, a.path, a.data).await?)
        }
        "rns_download" => {
            let a: NomadDownload = args(a)?;
            mesh.rns.download(&a.node, a.path).await
        }
        other => Err(format!("unknown_command: {other}")),
    }
}

/// Работа модуля: приветствие, команды из stdin, выход по его закрытию.
pub async fn run() {
    let _ = log::set_logger(&StderrLog);
    log::set_max_level(log::LevelFilter::Info);

    let mesh = Arc::new(Mesh::default());
    wire::hello();

    let mut lines = tokio::io::BufReader::new(tokio::io::stdin()).lines();
    // Команды — каждая своей задачей: страница NomadNet ждёт десятки секунд и
    // не должна держать запись в радио.
    let mut tasks = tokio::task::JoinSet::new();
    loop {
        tokio::select! {
            line = lines.next_line() => {
                let Ok(Some(line)) = line else { break };
                let req: wire::Request = match serde_json::from_str(&line) {
                    Ok(req) => req,
                    Err(e) => {
                        log::warn!("bad request: {e}");
                        continue;
                    }
                };
                let mesh = mesh.clone();
                tasks.spawn(async move {
                    let result = handle(&mesh, &req.cmd, req.args).await;
                    wire::reply(req.id, result);
                });
            }
            Some(_) = tasks.join_next(), if !tasks.is_empty() => {}
        }
    }

    // stdin закрылся: приложение вышло или останавливает модуль. Начатые
    // команды доделываются, но недолго: страница NomadNet ждала бы минуту.
    let _ = tokio::time::timeout(FINISH_ON_EXIT, async {
        while tasks.join_next().await.is_some() {}
    })
    .await;
    mesh.radio.shutdown().await;
    mesh.rns.shutdown().await;
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn unknown_command_and_bad_args_are_errors() {
        let mesh = Mesh::default();
        assert_eq!(
            handle(&mesh, "radio_selfdestruct", Value::Null).await,
            Err("unknown_command: radio_selfdestruct".into())
        );
        let err = handle(&mesh, "radio_write", serde_json::json!({ "link": 1 }))
            .await
            .unwrap_err();
        assert!(err.starts_with("bad_args: "), "{err}");
    }

    #[tokio::test]
    async fn node_commands_without_a_node() {
        let mesh = Mesh::default();
        let status = handle(&mesh, "rns_status", Value::Null).await.unwrap();
        assert_eq!(status["running"], false);
        assert_eq!(
            handle(&mesh, "rns_announce", Value::Null).await,
            Err("rns_not_running".into())
        );
        assert_eq!(
            handle(&mesh, "rns_stop", Value::Null).await,
            Ok(Value::Null)
        );
        // Закрыть неизвестное соединение — не ошибка: оно могло закрыться само.
        assert_eq!(
            handle(&mesh, "radio_close", serde_json::json!({ "link": 7 })).await,
            Ok(Value::Null)
        );
    }
}
