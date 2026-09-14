use crate::tor::state::SharedTorState;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use tokio::sync::mpsc;
use tokio_socks::tcp::Socks5Stream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::{CloseFrame, Message};

#[derive(Debug, Error)]
pub enum WsError {
    #[error("invalid url: {0}")]
    InvalidUrl(String),
    #[error("socks error: {0}")]
    Socks(#[from] tokio_socks::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("tls: {0}")]
    Tls(String),
    #[error("ws handshake: {0}")]
    Handshake(String),
    #[error("ws not found: {0}")]
    NotFound(String),
    #[error("send: {0}")]
    Send(String),
    #[error("bad ws id: {0}")]
    BadId(String),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum WsOutgoing {
    Text { data: String },
    Binary { data_b64: String },
    Ping { data_b64: Option<String> },
    Close { code: Option<u16>, reason: Option<String> },
}

pub struct WsHandle {
    pub tx: mpsc::Sender<WsOutgoing>,
    /// Reader-таск: при `close()` добиваем его после grace-периода, иначе сокет
    /// жил, пока сервер сам не пришлёт Close (S60).
    pub reader: tokio::task::JoinHandle<()>,
}

pub type SharedWsMap = Arc<DashMap<String, WsHandle>>;

/// Сколько ждём Close от сервера после нашего, прежде чем оборвать reader.
const CLOSE_GRACE: std::time::Duration = std::time::Duration::from_secs(5);

/// id приходит из JS (V22): только [A-Za-z0-9-], до 64 символов — он попадает
/// в имена событий `tor:ws:<id>:*`.
pub fn validate_id(id: &str) -> Result<(), WsError> {
    let ok = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if ok {
        Ok(())
    } else {
        Err(WsError::BadId(id.to_string()))
    }
}

pub async fn connect(
    app: AppHandle,
    map: SharedWsMap,
    shared: SharedTorState,
    id: String,
    url: String,
) -> Result<(), WsError> {
    validate_id(&id)?;
    if map.contains_key(&id) {
        return Err(WsError::BadId(format!("{} already in use", id)));
    }
    let parsed = url::Url::parse(&url).map_err(|e| WsError::InvalidUrl(e.to_string()))?;
    let scheme = parsed.scheme();
    let is_tls = match scheme {
        "ws" => false,
        "wss" => true,
        _ => return Err(WsError::InvalidUrl(format!("unsupported scheme {}", scheme))),
    };
    let host = parsed
        .host_str()
        .ok_or_else(|| WsError::InvalidUrl("missing host".into()))?
        .to_string();
    let port = parsed
        .port_or_known_default()
        .ok_or_else(|| WsError::InvalidUrl("missing port".into()))?;

    let socks_port = shared.read().await.socks_port;
    let socks_addr = format!("127.0.0.1:{}", socks_port);

    let raw = Socks5Stream::connect(socks_addr.as_str(), (host.as_str(), port))
        .await?
        .into_inner();

    let (tx, rx) = mpsc::channel::<WsOutgoing>(64);

    let request = url
        .as_str()
        .into_client_request()
        .map_err(|e| WsError::Handshake(e.to_string()))?;

    if is_tls {
        let connector = build_rustls_connector().map_err(WsError::Tls)?;
        let server_name = rustls_pki_types::ServerName::try_from(host.clone())
            .map_err(|e| WsError::Tls(e.to_string()))?;
        let tls = connector
            .connect(server_name, raw)
            .await
            .map_err(|e| WsError::Tls(e.to_string()))?;
        let (ws, _resp) = tokio_tungstenite::client_async(request, tls)
            .await
            .map_err(|e| WsError::Handshake(e.to_string()))?;
        let reader = spawn_ws_loops(app, map.clone(), id.clone(), ws, rx);
        map.insert(id, WsHandle { tx, reader });
    } else {
        let (ws, _resp) = tokio_tungstenite::client_async(request, raw)
            .await
            .map_err(|e| WsError::Handshake(e.to_string()))?;
        let reader = spawn_ws_loops(app, map.clone(), id.clone(), ws, rx);
        map.insert(id, WsHandle { tx, reader });
    }

    // Успешный возврат = OPEN для JS; отдельного события `open` больше нет —
    // оно эмитилось до того, как JS успевал подписаться (V22).
    Ok(())
}

/// Возвращает JoinHandle reader-таска. Writer завершается сам, когда `tx`
/// исчезает из карты (rx → None), и закрывает sink.
fn spawn_ws_loops<S>(
    app: AppHandle,
    map: SharedWsMap,
    id: String,
    ws: tokio_tungstenite::WebSocketStream<S>,
    mut rx: mpsc::Receiver<WsOutgoing>,
) -> tokio::task::JoinHandle<()>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (mut sink, mut stream) = ws.split();

    let event_msg = format!("tor:ws:{}:message", id);
    let event_close = format!("tor:ws:{}:close", id);
    let event_err = format!("tor:ws:{}:error", id);

    let app_reader = app.clone();
    let event_msg_r = event_msg.clone();
    let event_close_r = event_close.clone();
    let event_err_r = event_err.clone();
    let id_r = id.clone();
    let map_r = map.clone();
    let reader = tokio::spawn(async move {
        let mut close_sent = false;
        while let Some(msg) = stream.next().await {
            match msg {
                Ok(Message::Text(t)) => {
                    let _ = app_reader.emit(
                        &event_msg_r,
                        serde_json::json!({ "kind": "text", "data": t.to_string() }),
                    );
                }
                Ok(Message::Binary(b)) => {
                    let _ = app_reader.emit(
                        &event_msg_r,
                        serde_json::json!({ "kind": "binary", "data_b64": B64.encode(&b) }),
                    );
                }
                Ok(Message::Close(frame)) => {
                    let _ = app_reader.emit(
                        &event_close_r,
                        serde_json::json!({
                            "code": frame.as_ref().map(|f| u16::from(f.code)),
                            "reason": frame.as_ref().map(|f| f.reason.to_string()),
                        }),
                    );
                    close_sent = true;
                    break;
                }
                Ok(_) => {}
                Err(e) => {
                    let _ = app_reader.emit(&event_err_r, serde_json::json!({ "error": e.to_string() }));
                    break;
                }
            }
        }
        // Ошибка чтения / EOF без Close-фрейма = соединение мертво; JS ждёт
        // `close`, иначе остаётся в OPEN навсегда.
        if !close_sent {
            let _ = app_reader.emit(
                &event_close_r,
                serde_json::json!({ "code": 1006, "reason": "connection lost" }),
            );
        }
        // Серверный Close/ошибка: освобождаем карту → writer видит rx=None,
        // закрывает sink, сокет отпускается (S60).
        map_r.remove(&id_r);
        log::debug!("[tor:ws:{}] reader exit", id_r);
    });

    let app_writer = app.clone();
    let event_err_w = event_err.clone();
    let id_w = id.clone();
    tokio::spawn(async move {
        while let Some(item) = rx.recv().await {
            let to_send = match item {
                WsOutgoing::Text { data } => Message::Text(data.into()),
                WsOutgoing::Binary { data_b64 } => match B64.decode(&data_b64) {
                    Ok(b) => Message::Binary(b.into()),
                    Err(e) => {
                        let _ = app_writer.emit(
                            &event_err_w,
                            serde_json::json!({ "error": format!("bad base64: {}", e) }),
                        );
                        continue;
                    }
                },
                WsOutgoing::Ping { data_b64 } => {
                    let payload = data_b64
                        .and_then(|b| B64.decode(b).ok())
                        .unwrap_or_default();
                    Message::Ping(payload.into())
                }
                WsOutgoing::Close { code, reason } => {
                    let frame = match (code, reason) {
                        (Some(c), Some(r)) => Some(CloseFrame {
                            code: c.into(),
                            reason: r.into(),
                        }),
                        (Some(c), None) => Some(CloseFrame {
                            code: c.into(),
                            reason: "".into(),
                        }),
                        _ => None,
                    };
                    let _ = sink.send(Message::Close(frame)).await;
                    break;
                }
            };
            if let Err(e) = sink.send(to_send).await {
                let _ = app_writer.emit(&event_err_w, serde_json::json!({ "error": e.to_string() }));
                break;
            }
        }
        let _ = sink.close().await;
        log::debug!("[tor:ws:{}] writer exit", id_w);
    });

    reader
}

pub async fn send(map: &SharedWsMap, id: &str, outgoing: WsOutgoing) -> Result<(), WsError> {
    let handle = map
        .get(id)
        .ok_or_else(|| WsError::NotFound(id.to_string()))?;
    handle
        .tx
        .send(outgoing)
        .await
        .map_err(|e| WsError::Send(e.to_string()))?;
    Ok(())
}

pub async fn close(map: &SharedWsMap, id: &str) -> Result<(), WsError> {
    if let Some((_, handle)) = map.remove(id) {
        let WsHandle { tx, reader } = handle;
        let _ = tx
            .send(WsOutgoing::Close {
                code: Some(1000),
                reason: None,
            })
            .await;
        drop(tx);
        // Сервер может не ответить Close — тогда reader держал бы сокет вечно.
        tokio::spawn(async move {
            tokio::time::sleep(CLOSE_GRACE).await;
            if !reader.is_finished() {
                reader.abort();
            }
        });
    }
    Ok(())
}

/// `tor_stop`: SOCKS-порт исчезает вместе с процессом, сокеты всё равно мертвы.
pub async fn close_all(map: &SharedWsMap) {
    let ids: Vec<String> = map.iter().map(|e| e.key().clone()).collect();
    for id in ids {
        let _ = close(map, &id).await;
    }
}

fn build_rustls_connector() -> Result<tokio_rustls::TlsConnector, String> {
    use rustls_native_certs::load_native_certs;
    use std::sync::Arc;
    use tokio_rustls::rustls::{ClientConfig, RootCertStore};

    let mut roots = RootCertStore::empty();
    let result = load_native_certs();
    if result.certs.is_empty() && !result.errors.is_empty() {
        return Err(format!("no native roots: {:?}", result.errors));
    }
    for cert in result.certs {
        let _ = roots.add(cert);
    }
    let cfg = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    Ok(tokio_rustls::TlsConnector::from(Arc::new(cfg)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ws_id_must_be_event_safe() {
        assert!(validate_id("3f2b0c1e-9d7a-4b5c-8e6f-1a2b3c4d5e6f").is_ok());
        assert!(validate_id("abc123").is_ok());
        assert!(validate_id("").is_err());
        assert!(validate_id("has:colon").is_err());
        assert!(validate_id("has space").is_err());
        assert!(validate_id(&"x".repeat(65)).is_err());
    }
}
