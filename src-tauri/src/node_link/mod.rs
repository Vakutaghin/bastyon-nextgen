//! Прямое подключение к нодам Pocketnet — режим «Ноды напрямую» и запасной
//! путь режима «Авто», когда прокси (1–3.pocketnet.app) недоступны: в РФ их
//! адреса закрыты, а ноды отвечают. Только TLS-порты нод: API 38881
//! (`POST /public/`, `/post/`) и уведомления WSS 8887 (`/ws`). Сертификат
//! сверяет `verifier::PinVerifier`, отпечаток уходит в JS и запоминается там.
//!
//! Команды узкие нарочно: только https/wss, только эти пути. Запросом «куда
//! угодно с любым сертификатом» они не станут. При включённом Tor не работают
//! вовсе: мимо Tor приложение ничего не отправляет (V20).

mod verifier;

use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tokio::sync::mpsc;
use tokio_rustls::rustls::{self, ClientConfig};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

use crate::tor::ws::{self as tor_ws, SharedWsMap, WsHandle, WsOutgoing};
use crate::tor::TorManager;
use verifier::{PinVerifier, PIN_MISMATCH};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_TIMEOUT_MS: u64 = 120_000;
/// Клиентов держим по ноде и отпечатку — соединения переиспользуются.
const MAX_CLIENTS: usize = 256;
const WS_EVENTS: &str = "node:ws";

struct Client {
    http: reqwest::Client,
    seen: Arc<Mutex<Option<String>>>,
}

struct NodeLinkState {
    clients: DashMap<String, Arc<Client>>,
    sockets: SharedWsMap,
}

fn state() -> &'static NodeLinkState {
    static STATE: OnceLock<NodeLinkState> = OnceLock::new();
    STATE.get_or_init(|| NodeLinkState {
        clients: DashMap::new(),
        sockets: Arc::new(DashMap::new()),
    })
}

fn tls_config(verifier: Arc<PinVerifier>) -> Result<ClientConfig, String> {
    // Провайдер — явно: в сборке их два, и без выбора rustls паникует.
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    Ok(ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| e.to_string())?
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth())
}

async fn ensure_tor_off(tor: &TorManager) -> Result<(), String> {
    tor.refuse_direct().await
}

/// Хост и порт из адреса ноды; схема и путь — только разрешённые.
fn node_target(url: &str, scheme: &str, paths: &[&str]) -> Result<(String, u16), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("invalid url: {e}"))?;
    if parsed.scheme() != scheme {
        return Err(format!("invalid url: only {scheme}"));
    }
    if !paths.contains(&parsed.path()) || parsed.query().is_some() {
        return Err(format!("invalid url: path {}", parsed.path()));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("invalid url: credentials".into());
    }
    let host = parsed.host_str().ok_or("invalid url: no host")?.to_string();
    let port = parsed.port().ok_or("invalid url: no port")?;
    Ok((host, port))
}

fn client_for(host: &str, port: u16, pin: Option<String>) -> Result<Arc<Client>, String> {
    let key = format!("{host}:{port}|{}", pin.as_deref().unwrap_or(""));
    let st = state();
    if let Some(client) = st.clients.get(&key) {
        return Ok(client.clone());
    }
    let verifier = Arc::new(PinVerifier::new(pin));
    let seen = verifier.seen.clone();
    let http = reqwest::Client::builder()
        .use_preconfigured_tls(tls_config(verifier)?)
        .user_agent("Bastyon/1.0")
        .connect_timeout(CONNECT_TIMEOUT)
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;
    if st.clients.len() >= MAX_CLIENTS {
        st.clients.clear();
    }
    let client = Arc::new(Client { http, seen });
    st.clients.insert(key, client.clone());
    Ok(client)
}

/// Ошибка с причиной целиком: `pin_mismatch` лежит глубоко в цепочке.
fn error_chain(e: &(dyn std::error::Error + 'static)) -> String {
    let mut text = e.to_string();
    let mut source = e.source();
    while let Some(s) = source {
        text.push_str(": ");
        text.push_str(&s.to_string());
        source = s.source();
    }
    if text.contains(PIN_MISMATCH) {
        format!("{PIN_MISMATCH}: {text}")
    } else {
        text
    }
}

#[derive(Debug, Deserialize)]
pub struct NodeFetchRequest {
    url: String,
    body: String,
    pin: Option<String>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct NodeFetchResponse {
    status: u16,
    body: String,
    fingerprint: String,
}

/// RPC к ноде: `POST https://IP:38881/public/` (или `/post/`).
#[tauri::command]
pub async fn node_fetch(
    req: NodeFetchRequest,
    tor: State<'_, TorManager>,
) -> Result<NodeFetchResponse, String> {
    ensure_tor_off(&tor).await?;
    let (host, port) = node_target(&req.url, "https", &["/public/", "/post/"])?;
    let client = client_for(&host, port, req.pin)?;
    let timeout = req.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).min(MAX_TIMEOUT_MS);
    let res = client
        .http
        .post(&req.url)
        .header("Content-Type", "application/json")
        .body(req.body)
        .timeout(Duration::from_millis(timeout))
        .send()
        .await
        .map_err(|e| error_chain(&e))?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| error_chain(&e))?;
    let fingerprint = client.seen.lock().ok().and_then(|s| s.clone()).unwrap_or_default();
    Ok(NodeFetchResponse {
        status,
        body,
        fingerprint,
    })
}

#[derive(Debug, Serialize)]
pub struct NodeWsOpened {
    fingerprint: String,
}

/// Сокет уведомлений `wss://IP:8887/ws`. Как у `tor_ws_connect`: id даёт JS и
/// подписывается на `node:ws:<id>:*` заранее; успешный ответ — сокет открыт.
#[tauri::command]
pub async fn node_ws_connect(
    id: String,
    url: String,
    pin: Option<String>,
    app: AppHandle,
    tor: State<'_, TorManager>,
) -> Result<NodeWsOpened, String> {
    ensure_tor_off(&tor).await?;
    tor_ws::validate_id(&id).map_err(|e| e.to_string())?;
    let sockets = state().sockets.clone();
    if sockets.contains_key(&id) {
        return Err(format!("bad ws id: {id} already in use"));
    }
    let (host, port) = node_target(&url, "wss", &["/ws"])?;

    let tcp = tokio::time::timeout(CONNECT_TIMEOUT, tokio::net::TcpStream::connect((host.as_str(), port)))
        .await
        .map_err(|_| "connect timeout".to_string())?
        .map_err(|e| e.to_string())?;
    let verifier = Arc::new(PinVerifier::new(pin));
    let seen = verifier.seen.clone();
    let connector = tokio_rustls::TlsConnector::from(Arc::new(tls_config(verifier)?));
    let server_name = rustls_pki_types::ServerName::try_from(host.clone()).map_err(|e| e.to_string())?;
    let tls = tokio::time::timeout(CONNECT_TIMEOUT, connector.connect(server_name, tcp))
        .await
        .map_err(|_| "tls timeout".to_string())?
        .map_err(|e| error_chain(&e))?;
    let request = url.as_str().into_client_request().map_err(|e| e.to_string())?;
    let (ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, tokio_tungstenite::client_async(request, tls))
        .await
        .map_err(|_| "ws handshake timeout".to_string())?
        .map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel::<WsOutgoing>(64);
    let reader = tor_ws::spawn_ws_loops(app, sockets.clone(), id.clone(), ws, rx, WS_EVENTS);
    sockets.insert(id, WsHandle { tx, reader });
    let fingerprint = seen.lock().ok().and_then(|s| s.clone()).unwrap_or_default();
    Ok(NodeWsOpened { fingerprint })
}

#[tauri::command]
pub async fn node_ws_send(id: String, data: String) -> Result<(), String> {
    tor_ws::send(&state().sockets, &id, WsOutgoing::Text { data })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn node_ws_close(id: String) -> Result<(), String> {
    tor_ws::close(&state().sockets, &id).await.map_err(|e| e.to_string())
}

/// Tor включили — прямые сокеты закрываются.
pub async fn close_all() {
    tor_ws::close_all(&state().sockets).await;
    state().clients.clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_node_api_and_ws_paths_are_allowed() {
        assert_eq!(
            node_target("https://1.2.3.4:38881/public/", "https", &["/public/", "/post/"]).unwrap(),
            ("1.2.3.4".to_string(), 38881)
        );
        assert!(node_target("https://1.2.3.4:38881/post/", "https", &["/public/", "/post/"]).is_ok());
        assert!(node_target("http://1.2.3.4:38081/public/", "https", &["/public/"]).is_err());
        assert!(node_target("https://1.2.3.4:38881/admin", "https", &["/public/"]).is_err());
        assert!(node_target("https://1.2.3.4:38881/public/?x=1", "https", &["/public/"]).is_err());
        assert!(node_target("https://u:p@1.2.3.4:38881/public/", "https", &["/public/"]).is_err());
        assert!(node_target("https://1.2.3.4/public/", "https", &["/public/"]).is_err());
        assert!(node_target("wss://1.2.3.4:8887/ws", "wss", &["/ws"]).is_ok());
        assert!(node_target("ws://1.2.3.4:8087/ws", "wss", &["/ws"]).is_err());
    }

    /// Живая нода: `NODE_LINK_LIVE_HOST=109.197.196.106 cargo test node_link -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_node_answers_over_tls_with_its_v1_certificate() {
        let host = std::env::var("NODE_LINK_LIVE_HOST").expect("NODE_LINK_LIVE_HOST");
        let url = format!("https://{host}:38881/public/");
        let client = client_for(&host, 38881, None).unwrap();
        let res = client
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"method":"getnodeinfo","params":[]}"#)
            .send()
            .await
            .map_err(|e| error_chain(&e))
            .unwrap();
        assert_eq!(res.status().as_u16(), 200);
        assert!(res.text().await.unwrap().contains("lastblock"));
        let fp = client.seen.lock().unwrap().clone().unwrap();
        assert_eq!(fp.len(), 64);

        // Тот же адрес с чужим отпечатком — отказ до запроса.
        let wrong = client_for(&host, 38881, Some("00".repeat(32))).unwrap();
        let err = wrong.http.post(&url).body("{}").send().await.unwrap_err();
        assert!(error_chain(&err).starts_with(PIN_MISMATCH), "{}", error_chain(&err));
    }
}
