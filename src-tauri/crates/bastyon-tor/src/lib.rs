//! Tor приложения: одна логика для компьютера и Android. Отличия платформ —
//! в [`Host`] (откуда берутся файлы tor, что сделать до и после запуска) и
//! в [`Emitter`] (как события доходят до интерфейса). Команды Tauri
//! (src-tauri/src/tor) и JNI (bastyon-tor-jni) — тонкие обёртки над
//! методами [`TorManager`] с теми же именами и JSON.

pub mod bridges;
pub mod config;
pub mod connect;
pub mod moat;
pub mod process;
pub mod pt_config;
pub mod state;
pub mod ws;

use crate::process::TorChild;
use crate::pt_config::PtConfig;
use crate::state::{BridgeKind, SharedTorState, TorPaths, TorState, TorStateSnapshot, TorStatus};
use crate::ws::{SharedWsMap, WsOutgoing};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use dashmap::DashMap;
use futures_util::future::BoxFuture;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ops::Deref;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::sync::RwLock;

/// Ошибка `tor_fetch`/`tor_ws_connect`, когда Tor включён, но ещё не готов.
/// JS сверяет по этому префиксу и не уходит на прямое соединение (V20 fail-closed).
pub const TOR_NOT_READY: &str = "tor_not_ready";

/// Отказ прямому соединению при включённом Tor (`TorManager::refuse_direct`).
pub const TOR_ENABLED: &str = "tor_enabled";

/// Событие для интерфейса: имя (`tor:state`, `tor:ws:<id>:message`…) и JSON.
pub type Emitter = Arc<dyn Fn(&str, serde_json::Value) + Send + Sync>;

/// Файлы tor не готовы.
#[derive(Debug)]
pub enum BundleError {
    /// `tor_stop` прервал загрузку.
    Cancelled,
    Failed(String),
}

/// Что у платформ разное.
pub trait Host: Send + Sync + 'static {
    /// Файлы tor на месте. Компьютер скачивает закреплённый бандл (`cancel`
    /// прерывает загрузку), в APK они есть всегда.
    fn ensure_bundle<'a>(
        &'a self,
        paths: &'a TorPaths,
        cancel: &'a AtomicBool,
    ) -> BoxFuture<'a, Result<(), BundleError>>;

    /// Открыть ещё и HTTP-туннель Tor (`HTTPTunnelPort`) — для программ,
    /// которые умеют только HTTP-прокси (WebView и HttpURLConnection на
    /// Android). Имя хоста уходит в `CONNECT`, разрешает его Tor.
    fn http_tunnel(&self) -> bool {
        false
    }

    /// Перед запуском: с Tor мимо него ничего не идёт.
    fn before_start(&self) -> BoxFuture<'_, ()> {
        Box::pin(async {})
    }

    /// Надзор за подключением закончил: Tor подключился или сдался.
    fn after_supervise(&self, _mgr: TorManager) -> BoxFuture<'static, ()> {
        Box::pin(async {})
    }
}

/// Торифицированные reqwest-клиенты. Политика редиректов у reqwest per-client,
/// поэтому для `redirect: 'manual'` (fetch-tunnel мини-апп, V25) держим второй.
#[derive(Clone)]
pub struct TorClients {
    pub follow: reqwest::Client,
    pub no_redirect: reqwest::Client,
}

/// Один на приложение; клоны — тот же Tor (надзор живёт в фоновой задаче).
#[derive(Clone)]
pub struct TorManager(Arc<TorInner>);

pub struct TorInner {
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
    /// Установку бандла запускают и `tor_start`, и «Получить мосты»: две
    /// загрузки в один архив давали `SHA256 mismatch` (S59).
    pub install_lock: tokio::sync::Mutex<()>,
    /// Человек включил Tor: от `tor_start` до `tor_stop` без `restart`. Пока
    /// Tor перезапускается с новыми мостами, статус `Off`, а мимо Tor всё
    /// равно ничего не идёт (`refuse_direct`).
    pub wanted: AtomicBool,
    emit: Emitter,
    host: Arc<dyn Host>,
}

impl Deref for TorManager {
    type Target = TorInner;
    fn deref(&self) -> &TorInner {
        &self.0
    }
}

// ---------------------------------------------------------------------------
// Запросы и ответы команд (JSON — как у `invoke` на компьютере)
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

#[derive(Debug, Serialize)]
pub struct TorBridgesResult {
    pub snapshot: TorStateSnapshot,
    /// Строки «Своих мостов», не похожие на мост, — чтобы показать их в меню.
    pub rejected: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TorRequestedBridges {
    /// Страна, для которой Moat подобрал мосты (`ru`), если определил.
    pub country: Option<String>,
    pub bridges: Vec<String>,
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

fn err_string<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

enum StartAbort {
    /// `tor_stop` пришёл раньше — состояние уже `Off`, ничего не трогаем.
    Cancelled,
    Failed(String),
}

impl From<BundleError> for StartAbort {
    fn from(e: BundleError) -> Self {
        match e {
            BundleError::Cancelled => StartAbort::Cancelled,
            BundleError::Failed(msg) => StartAbort::Failed(msg),
        }
    }
}

impl TorManager {
    pub fn new(paths: TorPaths, emit: Emitter, host: Arc<dyn Host>) -> Self {
        Self(Arc::new(TorInner {
            state: Arc::new(RwLock::new(TorState::default())),
            paths,
            child: StdMutex::new(None),
            ws_map: Arc::new(DashMap::new()),
            torified: RwLock::new(None),
            install_cancel: Arc::new(AtomicBool::new(false)),
            start_gen: AtomicU64::new(0),
            install_lock: tokio::sync::Mutex::new(()),
            wanted: AtomicBool::new(false),
            emit,
            host,
        }))
    }

    /// Событие для интерфейса — тем же путём, что `tor:state`.
    pub fn emitter(&self) -> Emitter {
        self.emit.clone()
    }

    /// Прямое соединение (ноды напрямую, скачивание модулей, IPFS) — только
    /// когда Tor выключен: не включён человеком и не работает.
    pub async fn refuse_direct(&self) -> Result<(), String> {
        let status = self.state.read().await.status;
        if self.wanted.load(Ordering::SeqCst) || status != TorStatus::Off {
            return Err(format!("{TOR_ENABLED}: direct connections are off while Tor is on"));
        }
        Ok(())
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

    pub async fn emit_state(&self) {
        let snapshot = self.state.read().await.snapshot();
        (self.emit)("tor:state", serde_json::to_value(&snapshot).unwrap_or_default());
    }

    pub async fn status(&self) -> TorStateSnapshot {
        self.state.read().await.snapshot()
    }

    /// Убивает процесс, если он ещё жив (`Failed` с живым `tor` раньше
    /// порождал второго — S59).
    pub fn kill_child(&self) {
        let mut guard = self.child.lock().expect("tor child mutex poisoned");
        if let Some(mut child) = guard.take() {
            let _ = process::kill(&mut child);
        }
    }

    /// Сохраняет выбор мостов; применяется при следующем `tor_start`.
    pub async fn set_bridges(&self, payload: TorBridgesPayload) -> TorBridgesResult {
        let parsed = bridges::parse_lines(&payload.custom_bridges);
        let mut st = self.state.write().await;
        st.use_bridges = payload.use_bridges && payload.kind != BridgeKind::None;
        st.bridge_kind = payload.kind;
        st.custom_bridges = parsed.lines();
        TorBridgesResult {
            snapshot: st.snapshot(),
            rejected: parsed.rejected,
        }
    }

    /// «Получить мосты»: свежие мосты из BridgeDB для страны пользователя
    /// через Moat (без капчи) — для «Своих мостов». Страна без цензуры —
    /// общие запасные. Нужен бандл с lyrebird (на компьютере его сначала
    /// ставит обёртка).
    pub async fn request_bridges(&self) -> Result<TorRequestedBridges, String> {
        let pt = PtConfig::load(&self.paths.pt_dir);
        let settings = moat::settings_or_defaults(&self.paths, &pt)
            .await
            .map_err(err_string)?;
        let mut lines = settings.bridgedb_lines();
        if lines.is_empty() {
            lines = moat::circumvention_defaults(&self.paths, &pt)
                .await
                .map_err(err_string)?
                .bridgedb_lines();
        }
        Ok(TorRequestedBridges {
            country: settings.country,
            bridges: bridges::parse_lines(&lines).lines(),
        })
    }

    /// Установка и порты. Дальше подключением занимается `connect::supervise`.
    async fn prepare(&self, gen: u64) -> Result<(), StartAbort> {
        let still_ours = || self.start_gen.load(Ordering::SeqCst) == gen;

        {
            let mut st = self.state.write().await;
            if !still_ours() {
                return Err(StartAbort::Cancelled);
            }
            st.reset_attempt();
            st.status = TorStatus::Installing;
            st.message = Some("Preparing Tor".into());
        }
        self.emit_state().await;

        // До установки: на Windows работающий tor.exe не дал бы заменить бандл
        // новой версии, а `Failed` с живым `tor` раньше порождал второго (S59).
        self.kill_child();

        {
            let _install = self.install_lock.lock().await;
            self.host
                .ensure_bundle(&self.paths, &self.install_cancel)
                .await?;
        }
        if !still_ours() {
            return Err(StartAbort::Cancelled);
        }

        // Pick a free SOCKS/Control port pair so we don't collide with a zombie
        // tor or another app holding the default 9250/9251.
        if let Some((sp, cp)) = pick_free_port_pair() {
            let mut st = self.state.write().await;
            st.socks_port = sp;
            st.control_port = cp;
        }
        // Второй порт пары свободен: ControlPort приложение не открывает.
        if self.host.http_tunnel() {
            let mut st = self.state.write().await;
            st.http_tunnel_port = Some(st.control_port);
        }

        {
            let mut st = self.state.write().await;
            if !still_ours() {
                return Err(StartAbort::Cancelled);
            }
            st.status = TorStatus::Starting;
            st.message = Some("Launching tor".into());
        }
        self.emit_state().await;
        Ok(())
    }

    pub async fn start(&self) -> Result<TorStateSnapshot, String> {
        self.wanted.store(true, Ordering::SeqCst);
        {
            let st = self.state.read().await;
            // `Installing` тоже занят: второй `tor_start` во время загрузки писал
            // в тот же архив параллельно → `SHA256 mismatch` (S59).
            if matches!(
                st.status,
                TorStatus::Installing | TorStatus::Starting | TorStatus::Bootstrapping | TorStatus::Ready
            ) {
                return Ok(st.snapshot());
            }
        }

        self.host.before_start().await;

        let gen = self.start_gen.fetch_add(1, Ordering::SeqCst) + 1;
        self.install_cancel.store(false, Ordering::SeqCst);

        match self.prepare(gen).await {
            Ok(()) => {
                let mgr = self.clone();
                tokio::spawn(async move {
                    connect::supervise(&mgr, gen).await;
                    mgr.host.after_supervise(mgr.clone()).await;
                });
                Ok(self.status().await)
            }
            Err(StartAbort::Cancelled) => Ok(self.status().await),
            Err(StartAbort::Failed(msg)) => {
                // Раньше ошибка установки оставляла статус `Installing` навсегда.
                if self.start_gen.load(Ordering::SeqCst) == gen {
                    let mut st = self.state.write().await;
                    st.status = TorStatus::Failed;
                    st.message = Some(msg.clone());
                    st.child_pid = None;
                    st.keep_going = false;
                }
                self.emit_state().await;
                Err(msg)
            }
        }
    }

    /// `restart` — перезапуск с новыми мостами: Tor остаётся включённым, и
    /// прямые соединения между остановкой и `tor_start` по-прежнему закрыты.
    pub async fn stop(&self, restart: bool) -> TorStateSnapshot {
        if !restart {
            self.wanted.store(false, Ordering::SeqCst);
        }
        // Инвалидируем запуск в полёте и прерываем загрузку архива.
        self.start_gen.fetch_add(1, Ordering::SeqCst);
        self.install_cancel.store(true, Ordering::SeqCst);

        // Состояние — ДО kill: поток логов по EOF помечает `Failed` только если
        // `child_pid` всё ещё его (см. process::stream_log).
        {
            let mut st = self.state.write().await;
            st.status = TorStatus::Off;
            st.reset_attempt();
        }
        self.kill_child();
        *self.torified.write().await = None;
        ws::close_all(&self.ws_map).await;
        self.emit_state().await;
        self.status().await
    }

    pub async fn fetch(&self, req: TorFetchRequest) -> Result<TorFetchResponse, String> {
        if is_private_target(&req.url) {
            return Err(format!("tor_fetch: private/loopback target rejected: {}", req.url));
        }
        let client = self.pick_client(req.no_redirect).await?;

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

    /// `id` генерирует JS и подписывается на события ДО вызова — иначе `open`
    /// и первые сообщения терялись (Tauri не буферизует события, V22).
    pub async fn ws_connect(&self, id: String, url: String) -> Result<(), String> {
        if self.state.read().await.status != TorStatus::Ready {
            return Err(TOR_NOT_READY.to_string());
        }
        ws::connect(self.emitter(), self.ws_map.clone(), self.state.clone(), id, url)
            .await
            .map_err(err_string)
    }

    pub async fn ws_send(&self, id: &str, payload: WsSendPayload) -> Result<(), String> {
        ws::send(&self.ws_map, id, payload.into())
            .await
            .map_err(err_string)
    }

    pub async fn ws_close(&self, id: &str) -> Result<(), String> {
        ws::close(&self.ws_map, id).await.map_err(err_string)
    }
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
pub fn pick_free_port_pair() -> Option<(u16, u16)> {
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

/// Хост без загрузки и без событий — для проверок.
#[cfg(test)]
pub(crate) mod testing {
    use super::*;

    pub struct BundleOnDisk;

    impl Host for BundleOnDisk {
        fn ensure_bundle<'a>(
            &'a self,
            _paths: &'a TorPaths,
            _cancel: &'a AtomicBool,
        ) -> BoxFuture<'a, Result<(), BundleError>> {
            Box::pin(async { Ok(()) })
        }
    }

    pub fn manager(paths: TorPaths) -> TorManager {
        TorManager::new(paths, Arc::new(|_: &str, _| {}), Arc::new(BundleOnDisk))
    }
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
        let mgr = testing::manager(TorPaths::from_root(std::env::temp_dir().join("tor-test")));
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

    #[tokio::test]
    async fn direct_connections_wait_for_tor_to_be_turned_off() {
        let mgr = testing::manager(TorPaths::from_root(std::env::temp_dir().join("tor-test")));
        assert!(mgr.refuse_direct().await.is_ok(), "Tor off");
        mgr.state.write().await.status = TorStatus::Ready;
        assert!(mgr.refuse_direct().await.is_err(), "Tor running");
        // Перезапуск с новыми мостами: статус `Off`, а Tor всё ещё включён.
        mgr.state.write().await.status = TorStatus::Off;
        mgr.wanted.store(true, Ordering::SeqCst);
        let err = mgr.refuse_direct().await.unwrap_err();
        assert!(err.starts_with(TOR_ENABLED), "{err}");
        mgr.wanted.store(false, Ordering::SeqCst);
        assert!(mgr.refuse_direct().await.is_ok());
    }

    /// Ошибка подготовки файлов — `Failed` с причиной, а не вечный `Installing`.
    #[tokio::test]
    async fn bundle_failure_marks_failed() {
        struct Broken;
        impl Host for Broken {
            fn ensure_bundle<'a>(
                &'a self,
                _paths: &'a TorPaths,
                _cancel: &'a AtomicBool,
            ) -> BoxFuture<'a, Result<(), BundleError>> {
                Box::pin(async { Err(BundleError::Failed("no tor".into())) })
            }
        }
        let events = Arc::new(StdMutex::new(Vec::<String>::new()));
        let seen = events.clone();
        let emit: Emitter = Arc::new(move |name: &str, payload| {
            seen.lock().unwrap().push(format!("{name} {}", payload["status"]));
        });
        let paths = TorPaths::from_root(std::env::temp_dir().join("tor-test"));
        let mgr = TorManager::new(paths, emit, Arc::new(Broken));
        assert_eq!(mgr.start().await.unwrap_err(), "no tor");
        let snap = mgr.status().await;
        assert_eq!(snap.status, TorStatus::Failed);
        assert_eq!(snap.message.as_deref(), Some("no tor"));
        assert_eq!(
            *events.lock().unwrap(),
            ["tor:state \"installing\"", "tor:state \"failed\""]
        );
        assert!(mgr.refuse_direct().await.is_err(), "still wanted");
        mgr.stop(false).await;
        assert!(mgr.refuse_direct().await.is_ok());
    }
}
