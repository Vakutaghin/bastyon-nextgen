pub mod config;
pub mod installer;
pub mod process;
pub mod state;
pub mod ws;

use crate::tor::installer::InstallError;
use crate::tor::process::TorChild;
use crate::tor::state::{
    BridgeKind, SharedTorState, TorPaths, TorState, TorStateSnapshot, TorStatus,
};
use crate::tor::ws::{SharedWsMap, WsOutgoing};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;

/// Ошибка `tor_fetch`/`tor_ws_connect`, когда Tor включён, но ещё не готов.
/// JS сверяет по этому префиксу и не уходит на прямое соединение (V20 fail-closed).
pub const TOR_NOT_READY: &str = "tor_not_ready";

/// Торифицированные reqwest-клиенты. Политика редиректов у reqwest per-client,
/// поэтому для `redirect: 'manual'` (fetch-tunnel мини-апп, V25) держим второй.
#[derive(Clone)]
pub struct TorClients {
    pub follow: reqwest::Client,
    pub no_redirect: reqwest::Client,
}

pub struct TorManager {
    pub state: SharedTorState,
    pub paths: TorPaths,
    /// Held synchronously; never across an `.await` boundary.
    /// Allows shutdown handler to kill the process without a tokio runtime.
    pub child: StdMutex<Option<TorChild>>,
    pub ws_map: SharedWsMap,
    pub torified: RwLock<Option<TorClients>>,
    /// `tor_stop` во время установки прерывает загрузку архива (S59).
    pub install_cancel: Arc<AtomicBool>,
    /// Поколение запуска: `tor_stop` инкрементирует, и застрявший в `.await`
    /// `tor_start` не воскрешает состояние после остановки (S59).
    pub start_gen: AtomicU64,
}

impl TorManager {
    pub fn new(paths: TorPaths) -> Self {
        Self {
            state: Arc::new(RwLock::new(TorState::default())),
            paths,
            child: StdMutex::new(None),
            ws_map: Arc::new(DashMap::new()),
            torified: RwLock::new(None),
            install_cancel: Arc::new(AtomicBool::new(false)),
            start_gen: AtomicU64::new(0),
        }
    }

    fn build_torified_clients(socks_port: u16) -> reqwest::Result<TorClients> {
        let proxy_url = format!("socks5h://127.0.0.1:{}", socks_port);
        let follow = reqwest::Client::builder()
            .proxy(reqwest::Proxy::all(&proxy_url)?)
            .user_agent("Bastyon/1.0")
            .timeout(Duration::from_secs(120))
            .build()?;
        let no_redirect = reqwest::Client::builder()
            .proxy(reqwest::Proxy::all(&proxy_url)?)
            .user_agent("Bastyon/1.0")
            .timeout(Duration::from_secs(120))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(TorClients { follow, no_redirect })
    }

    /// Fail-closed (V20): клиент есть только при `Ready`. Прямого fallback нет —
    /// раньше во время бутстрапа запросы с подписью уходили мимо Tor.
    async fn pick_client(&self, no_redirect: bool) -> Result<reqwest::Client, String> {
        let st = self.state.read().await;
        if st.status != TorStatus::Ready {
            return Err(format!("{}: status={:?}", TOR_NOT_READY, st.status));
        }
        let socks_port = st.socks_port;
        drop(st);
        let mut guard = self.torified.write().await;
        if guard.is_none() {
            *guard = Some(Self::build_torified_clients(socks_port).map_err(err_string)?);
        }
        let clients = guard.as_ref().expect("torified clients just built");
        Ok(if no_redirect {
            clients.no_redirect.clone()
        } else {
            clients.follow.clone()
        })
    }

    pub async fn emit_state(&self, app: &AppHandle) {
        let snapshot = self.state.read().await.snapshot();
        let _ = app.emit("tor:state", &snapshot);
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct TorFetchRequest {
    pub url: String,
    pub method: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body_b64: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    /// `redirect: 'manual'` из fetch-init: 3xx возвращается как есть.
    #[serde(default)]
    pub no_redirect: bool,
}

#[derive(Debug, Serialize)]
pub struct TorFetchResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    pub body_b64: String,
    pub final_url: String,
    pub used_tor: bool,
}

#[derive(Debug, Deserialize)]
pub struct TorBridgesPayload {
    pub use_bridges: bool,
    pub kind: BridgeKind,
    #[serde(default)]
    pub custom_bridges: Vec<String>,
}

fn err_string<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn tor_status(mgr: State<'_, TorManager>) -> Result<TorStateSnapshot, String> {
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn tor_set_bridges(
    payload: TorBridgesPayload,
    mgr: State<'_, TorManager>,
) -> Result<TorStateSnapshot, String> {
    let mut st = mgr.state.write().await;
    st.use_bridges = payload.use_bridges;
    st.bridge_kind = payload.kind;
    st.custom_bridges = payload.custom_bridges;
    Ok(st.snapshot())
}

enum StartAbort {
    /// `tor_stop` пришёл раньше — состояние уже `Off`, ничего не трогаем.
    Cancelled,
    Failed(String),
}

impl From<InstallError> for StartAbort {
    fn from(e: InstallError) -> Self {
        match e {
            InstallError::Cancelled => StartAbort::Cancelled,
            other => StartAbort::Failed(other.to_string()),
        }
    }
}

/// Убивает предыдущий процесс, если он ещё жив (`Failed` с живым `tor`
/// раньше порождал второго — S59).
fn kill_existing_child(mgr: &TorManager) {
    let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
    if let Some(mut child) = guard.take() {
        let _ = process::kill(&mut child);
    }
}

async fn start_inner(
    app: &AppHandle,
    mgr: &TorManager,
    gen: u64,
) -> Result<TorStateSnapshot, StartAbort> {
    let still_ours = || mgr.start_gen.load(Ordering::SeqCst) == gen;

    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Installing;
        st.message = Some("Preparing Tor".into());
        st.bootstrap_pct = 0;
    }
    mgr.emit_state(app).await;

    installer::ensure_installed(app, &mgr.paths, &mgr.install_cancel).await?;
    if !still_ours() {
        return Err(StartAbort::Cancelled);
    }

    kill_existing_child(mgr);

    // Pick a free SOCKS/Control port pair so we don't collide with a zombie
    // tor or another app holding the default 9250/9251.
    if let Some((sp, cp)) = pick_free_port_pair() {
        let mut st = mgr.state.write().await;
        st.socks_port = sp;
        st.control_port = cp;
    }

    {
        let st = mgr.state.read().await;
        config::write_torrc(&st, &mgr.paths).map_err(|e| StartAbort::Failed(e.to_string()))?;
    }

    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Starting;
        st.message = Some("Launching tor".into());
    }
    mgr.emit_state(app).await;

    let mut child = process::spawn(app.clone(), &mgr.paths, mgr.state.clone())
        .map_err(|e| StartAbort::Failed(e.to_string()))?;
    let pid = child.pid();

    if !still_ours() {
        let _ = process::kill(&mut child);
        return Err(StartAbort::Cancelled);
    }

    {
        let mut st = mgr.state.write().await;
        st.child_pid = Some(pid);
        st.status = TorStatus::Bootstrapping;
    }
    mgr.emit_state(app).await;

    {
        let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
        *guard = Some(child);
    }

    // Reset cached torified clients; rebuilt on first fetch after Ready.
    *mgr.torified.write().await = None;

    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn tor_start(
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<TorStateSnapshot, String> {
    {
        let st = mgr.state.read().await;
        // `Installing` тоже занят: второй `tor_start` во время загрузки писал
        // в тот же архив параллельно → `SHA256 mismatch` (S59).
        if matches!(
            st.status,
            TorStatus::Installing | TorStatus::Starting | TorStatus::Bootstrapping | TorStatus::Ready
        ) {
            return Ok(st.snapshot());
        }
    }

    let gen = mgr.start_gen.fetch_add(1, Ordering::SeqCst) + 1;
    mgr.install_cancel.store(false, Ordering::SeqCst);

    match start_inner(&app, &mgr, gen).await {
        Ok(snap) => Ok(snap),
        Err(StartAbort::Cancelled) => Ok(mgr.state.read().await.snapshot()),
        Err(StartAbort::Failed(msg)) => {
            // Раньше ошибка установки оставляла статус `Installing` навсегда.
            if mgr.start_gen.load(Ordering::SeqCst) == gen {
                let mut st = mgr.state.write().await;
                st.status = TorStatus::Failed;
                st.message = Some(msg.clone());
                st.child_pid = None;
            }
            mgr.emit_state(&app).await;
            Err(msg)
        }
    }
}

#[tauri::command]
pub async fn tor_stop(
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<TorStateSnapshot, String> {
    // Инвалидируем запуск в полёте и прерываем загрузку архива.
    mgr.start_gen.fetch_add(1, Ordering::SeqCst);
    mgr.install_cancel.store(true, Ordering::SeqCst);

    // Состояние — ДО kill: поток логов по EOF помечает `Failed` только если
    // `child_pid` всё ещё его (см. process::stream_log).
    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Off;
        st.bootstrap_pct = 0;
        st.message = None;
        st.child_pid = None;
    }
    kill_existing_child(&mgr);
    *mgr.torified.write().await = None;
    ws::close_all(&mgr.ws_map).await;
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn tor_fetch(
    req: TorFetchRequest,
    mgr: State<'_, TorManager>,
) -> Result<TorFetchResponse, String> {
    if is_private_target(&req.url) {
        return Err(format!("tor_fetch: private/loopback target rejected: {}", req.url));
    }
    let client = mgr.pick_client(req.no_redirect).await?;

    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| format!("bad method: {}", e))?;

    let mut builder = client.request(method, &req.url);

    let mut hm = reqwest::header::HeaderMap::new();
    for (k, v) in &req.headers {
        let name = reqwest::header::HeaderName::from_bytes(k.as_bytes())
            .map_err(|e| format!("bad header name {}: {}", k, e))?;
        let value = reqwest::header::HeaderValue::from_str(v)
            .map_err(|e| format!("bad header value for {}: {}", k, e))?;
        hm.insert(name, value);
    }
    builder = builder.headers(hm);

    if let Some(b64) = req.body_b64.as_ref() {
        let bytes = B64.decode(b64).map_err(|e| format!("bad body_b64: {}", e))?;
        builder = builder.body(bytes);
    }

    if let Some(ms) = req.timeout_ms {
        builder = builder.timeout(Duration::from_millis(ms));
    }

    let resp = builder.send().await.map_err(err_string)?;
    let final_url = resp.url().to_string();
    let status = resp.status().as_u16();
    let status_text = resp
        .status()
        .canonical_reason()
        .unwrap_or("")
        .to_string();
    let headers: Vec<(String, String)> = resp
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.to_string(), s.to_string())))
        .collect();
    let body = resp.bytes().await.map_err(err_string)?;
    Ok(TorFetchResponse {
        status,
        status_text,
        headers,
        body_b64: B64.encode(&body),
        final_url,
        used_tor: true,
    })
}

/// `id` генерирует JS и подписывается на события ДО invoke — иначе `open`
/// и первые сообщения терялись (Tauri не буферизует события, V22).
#[tauri::command]
pub async fn tor_ws_connect(
    id: String,
    url: String,
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<(), String> {
    if mgr.state.read().await.status != TorStatus::Ready {
        return Err(TOR_NOT_READY.to_string());
    }
    ws::connect(app, mgr.ws_map.clone(), mgr.state.clone(), id, url)
        .await
        .map_err(err_string)
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum WsSendPayload {
    Text { data: String },
    Binary { data_b64: String },
    Ping { data_b64: Option<String> },
    Close { code: Option<u16>, reason: Option<String> },
}

impl From<WsSendPayload> for WsOutgoing {
    fn from(p: WsSendPayload) -> Self {
        match p {
            WsSendPayload::Text { data } => WsOutgoing::Text { data },
            WsSendPayload::Binary { data_b64 } => WsOutgoing::Binary { data_b64 },
            WsSendPayload::Ping { data_b64 } => WsOutgoing::Ping { data_b64 },
            WsSendPayload::Close { code, reason } => WsOutgoing::Close { code, reason },
        }
    }
}

#[tauri::command]
pub async fn tor_ws_send(
    id: String,
    payload: WsSendPayload,
    mgr: State<'_, TorManager>,
) -> Result<(), String> {
    ws::send(&mgr.ws_map, &id, payload.into())
        .await
        .map_err(err_string)
}

#[tauri::command]
pub async fn tor_ws_close(id: String, mgr: State<'_, TorManager>) -> Result<(), String> {
    ws::close(&mgr.ws_map, &id).await.map_err(err_string)
}

/// Литеральные loopback/private/link-local адреса и `localhost`/`.local`
/// через Tor не ходят и служат только SSRF-зондом из мини-апп (V25).
pub fn is_private_target(raw: &str) -> bool {
    let Ok(parsed) = url::Url::parse(raw) else {
        return true;
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return true;
    }
    match parsed.host() {
        None => true,
        Some(url::Host::Ipv4(ip)) => {
            ip.is_loopback()
                || ip.is_private()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
        }
        Some(url::Host::Ipv6(ip)) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return v4.is_loopback()
                    || v4.is_private()
                    || v4.is_link_local()
                    || v4.is_unspecified();
            }
            let seg0 = ip.segments()[0];
            ip.is_loopback()
                || ip.is_unspecified()
                || (seg0 & 0xfe00) == 0xfc00 // ULA fc00::/7
                || (seg0 & 0xffc0) == 0xfe80 // link-local fe80::/10
        }
        Some(url::Host::Domain(d)) => {
            let d = d.to_ascii_lowercase();
            d == "localhost" || d.ends_with(".localhost") || d.ends_with(".local")
        }
    }
}

/// Probe localhost for an unused (SOCKS, Control) port pair. Tries the
/// preferred 9250/9251 first; falls back to a higher range if those are taken.
fn pick_free_port_pair() -> Option<(u16, u16)> {
    use std::net::TcpListener;
    fn try_bind(port: u16) -> bool {
        TcpListener::bind(("127.0.0.1", port)).is_ok()
    }
    if try_bind(9250) && try_bind(9251) {
        return Some((9250, 9251));
    }
    for base in (9300u16..=9900).step_by(2) {
        if try_bind(base) && try_bind(base + 1) {
            return Some((base, base + 1));
        }
    }
    None
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
    let manager = TorManager::new(paths);
    app.manage(manager);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_targets_are_rejected() {
        for u in [
            "http://127.0.0.1:8080/x",
            "https://localhost/",
            "https://foo.localhost/",
            "http://10.0.0.5/",
            "http://192.168.1.1/",
            "http://172.16.0.1/",
            "http://169.254.169.254/latest/meta-data",
            "http://0.0.0.0/",
            "http://[::1]/",
            "http://[fe80::1]/",
            "http://[fd00::1]/",
            "http://[::ffff:127.0.0.1]/",
            "https://printer.local/",
            "ftp://example.org/",
            "not a url",
        ] {
            assert!(is_private_target(u), "{u} must be rejected");
        }
    }

    #[test]
    fn public_targets_are_allowed() {
        for u in [
            "https://1.pocketnet.app:8899/rpc/x",
            "https://api.coingecko.com/api/v3/simple/price",
            "http://example.org/",
            "https://abc.onion/",
            "http://8.8.8.8/",
        ] {
            assert!(!is_private_target(u), "{u} must be allowed");
        }
    }

    #[tokio::test]
    async fn fetch_client_is_fail_closed_when_tor_not_ready() {
        let mgr = TorManager::new(TorPaths::from_root(std::env::temp_dir().join("tor-test")));
        for status in [
            TorStatus::Off,
            TorStatus::Installing,
            TorStatus::Starting,
            TorStatus::Bootstrapping,
            TorStatus::Failed,
        ] {
            mgr.state.write().await.status = status;
            let err = mgr.pick_client(false).await.err().expect("must refuse");
            assert!(err.starts_with(TOR_NOT_READY), "{err}");
        }
        mgr.state.write().await.status = TorStatus::Ready;
        assert!(mgr.pick_client(false).await.is_ok());
        assert!(mgr.pick_client(true).await.is_ok());
    }
}
