pub mod config;
pub mod installer;
pub mod process;
pub mod state;
pub mod ws;

use crate::tor::process::TorChild;
use crate::tor::state::{
    BridgeKind, SharedTorState, TorPaths, TorState, TorStateSnapshot, TorStatus,
};
use crate::tor::ws::{SharedWsMap, WsOutgoing};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::RwLock;

pub struct TorManager {
    pub state: SharedTorState,
    pub paths: TorPaths,
    /// Held synchronously; never across an `.await` boundary.
    /// Allows shutdown handler to kill the process without a tokio runtime.
    pub child: StdMutex<Option<TorChild>>,
    pub ws_map: SharedWsMap,
    pub torified_client: RwLock<Option<reqwest::Client>>,
    pub direct_client: reqwest::Client,
}

impl TorManager {
    pub fn new(paths: TorPaths) -> Self {
        let direct = reqwest::Client::builder()
            .user_agent("Bastyon/1.0")
            .timeout(Duration::from_secs(60))
            .build()
            .expect("build direct reqwest client");
        Self {
            state: Arc::new(RwLock::new(TorState::default())),
            paths,
            child: StdMutex::new(None),
            ws_map: Arc::new(DashMap::new()),
            torified_client: RwLock::new(None),
            direct_client: direct,
        }
    }

    async fn build_torified_client(&self, socks_port: u16) -> reqwest::Result<reqwest::Client> {
        let proxy_url = format!("socks5h://127.0.0.1:{}", socks_port);
        let proxy = reqwest::Proxy::all(&proxy_url)?;
        reqwest::Client::builder()
            .proxy(proxy)
            .user_agent("Bastyon/1.0")
            .timeout(Duration::from_secs(120))
            .build()
    }

    async fn pick_client(&self) -> reqwest::Client {
        let st = self.state.read().await;
        if st.status == TorStatus::Ready {
            let socks_port = st.socks_port;
            drop(st);
            let mut guard = self.torified_client.write().await;
            if guard.is_none() {
                if let Ok(c) = self.build_torified_client(socks_port).await {
                    *guard = Some(c);
                }
            }
            if let Some(c) = guard.clone() {
                return c;
            }
        }
        self.direct_client.clone()
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

#[tauri::command]
pub async fn tor_start(
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<TorStateSnapshot, String> {
    {
        let st = mgr.state.read().await;
        if matches!(st.status, TorStatus::Starting | TorStatus::Bootstrapping | TorStatus::Ready) {
            return Ok(st.snapshot());
        }
    }

    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Installing;
        st.message = Some("Preparing Tor".into());
        st.bootstrap_pct = 0;
    }
    mgr.emit_state(&app).await;

    installer::ensure_installed(&app, &mgr.paths)
        .await
        .map_err(err_string)?;

    // Pick a free SOCKS/Control port pair so we don't collide with a zombie
    // tor or another app holding the default 9250/9251.
    if let Some((sp, cp)) = pick_free_port_pair() {
        let mut st = mgr.state.write().await;
        st.socks_port = sp;
        st.control_port = cp;
    }

    {
        let st = mgr.state.read().await;
        config::write_torrc(&st, &mgr.paths).map_err(err_string)?;
    }

    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Starting;
        st.message = Some("Launching tor".into());
    }
    mgr.emit_state(&app).await;

    let child = process::spawn(app.clone(), &mgr.paths, mgr.state.clone()).map_err(err_string)?;
    let pid = child.pid();

    {
        let mut st = mgr.state.write().await;
        st.child_pid = Some(pid);
        st.status = TorStatus::Bootstrapping;
    }
    mgr.emit_state(&app).await;

    {
        let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
        *guard = Some(child);
    }

    // Reset cached torified client; rebuilt on first fetch after Ready.
    *mgr.torified_client.write().await = None;

    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn tor_stop(
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<TorStateSnapshot, String> {
    {
        let mut guard = mgr.child.lock().expect("tor child mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = process::kill(&mut child);
        }
    }
    {
        let mut st = mgr.state.write().await;
        st.status = TorStatus::Off;
        st.bootstrap_pct = 0;
        st.message = None;
        st.child_pid = None;
    }
    *mgr.torified_client.write().await = None;
    mgr.emit_state(&app).await;
    Ok(mgr.state.read().await.snapshot())
}

#[tauri::command]
pub async fn tor_fetch(
    req: TorFetchRequest,
    mgr: State<'_, TorManager>,
) -> Result<TorFetchResponse, String> {
    let client = mgr.pick_client().await;
    let used_tor = mgr.state.read().await.status == TorStatus::Ready;

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
        used_tor,
    })
}

#[tauri::command]
pub async fn tor_ws_connect(
    url: String,
    app: AppHandle,
    mgr: State<'_, TorManager>,
) -> Result<String, String> {
    ws::connect(app, mgr.ws_map.clone(), mgr.state.clone(), url)
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
