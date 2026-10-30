use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TorStatus {
    Off,
    Installing,
    Starting,
    Bootstrapping,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BridgeKind {
    None,
    /// Подбор по стране через Moat, как Connection Assist в Tor Browser.
    Auto,
    Snowflake,
    Obfs4,
    /// Встроенный meek_lite (domain fronting через CDN).
    Meek,
    /// Строки пользователя, любой транспорт бандла.
    Custom,
}

impl Default for BridgeKind {
    fn default() -> Self {
        BridgeKind::None
    }
}

/// Ошибки, у которых в меню свой текст, а не строка из лога Tor.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TorErrorCode {
    /// «Автоматически» перебрал всё и не подключился.
    AllMethodsFailed,
    /// «Свои мосты» пусты или ни одна строка не похожа на мост.
    NoValidBridges,
}

#[derive(Debug, Clone, Serialize)]
pub struct TorStateSnapshot {
    pub status: TorStatus,
    pub bootstrap_pct: u8,
    pub message: Option<String>,
    pub socks_port: u16,
    pub control_port: u16,
    pub use_bridges: bool,
    pub bridge_kind: BridgeKind,
    /// Чем подключается текущая попытка: `direct`, `snowflake`, `webtunnel`…
    pub active_transport: Option<String>,
    /// Номер попытки автоподбора (с 1); 0 — ещё не начинали.
    pub attempt: u8,
    /// Страна по данным Moat (`ru`), если автоподбор её узнал.
    pub country: Option<String>,
    /// Бутстрап давно не двигается — способ, похоже, заблокирован.
    pub stalled: bool,
    /// Идёт запрос мостов у Moat.
    pub fetching_bridges: bool,
    pub error_code: Option<TorErrorCode>,
    /// HTTP-туннель Tor (`HTTPTunnelPort`, Android: WebView и Java); `None` — нет.
    pub http_tunnel_port: Option<u16>,
}

#[derive(Debug)]
pub struct TorState {
    pub status: TorStatus,
    pub bootstrap_pct: u8,
    pub message: Option<String>,
    pub socks_port: u16,
    pub control_port: u16,
    pub http_tunnel_port: Option<u16>,
    pub child_pid: Option<u32>,
    pub use_bridges: bool,
    pub bridge_kind: BridgeKind,
    /// Уже проверенные строки (`bridges::parse_lines`).
    pub custom_bridges: Vec<String>,
    pub active_transport: Option<String>,
    /// Мосты текущей попытки — их и пишет torrc; пусто — без мостов.
    pub active_bridges: Vec<String>,
    pub attempt: u8,
    pub country: Option<String>,
    pub stalled: bool,
    pub fetching_bridges: bool,
    pub error_code: Option<TorErrorCode>,
    /// Автоподбор: ошибка или смерть процесса — повод перейти к следующей
    /// попытке, а не `Failed` (иначе запросы падали бы между попытками).
    pub keep_going: bool,
    /// Текущая попытка провалилась (при `keep_going`).
    pub candidate_failed: bool,
    /// Сколько раз умер транспорт в текущей попытке.
    pub pt_failures: u32,
}

impl Default for TorState {
    fn default() -> Self {
        Self {
            status: TorStatus::Off,
            bootstrap_pct: 0,
            message: None,
            socks_port: 9250,
            control_port: 9251,
            http_tunnel_port: None,
            child_pid: None,
            use_bridges: false,
            bridge_kind: BridgeKind::None,
            custom_bridges: Vec::new(),
            active_transport: None,
            active_bridges: Vec::new(),
            attempt: 0,
            country: None,
            stalled: false,
            fetching_bridges: false,
            error_code: None,
            keep_going: false,
            candidate_failed: false,
            pt_failures: 0,
        }
    }
}

impl TorState {
    pub fn snapshot(&self) -> TorStateSnapshot {
        TorStateSnapshot {
            status: self.status,
            bootstrap_pct: self.bootstrap_pct,
            message: self.message.clone(),
            socks_port: self.socks_port,
            control_port: self.control_port,
            use_bridges: self.use_bridges,
            bridge_kind: self.bridge_kind,
            active_transport: self.active_transport.clone(),
            attempt: self.attempt,
            country: self.country.clone(),
            stalled: self.stalled,
            fetching_bridges: self.fetching_bridges,
            error_code: self.error_code,
            http_tunnel_port: self.http_tunnel_port,
        }
    }

    /// Сброс перед новым запуском: прошлые попытка, ошибка и флаги не тянутся.
    pub fn reset_attempt(&mut self) {
        self.bootstrap_pct = 0;
        self.message = None;
        self.child_pid = None;
        self.active_transport = None;
        self.active_bridges.clear();
        self.attempt = 0;
        self.stalled = false;
        self.fetching_bridges = false;
        self.error_code = None;
        self.keep_going = false;
        self.candidate_failed = false;
        self.pt_failures = 0;
    }
}

pub type SharedTorState = Arc<RwLock<TorState>>;

#[derive(Debug, Clone)]
pub struct TorPaths {
    pub root: PathBuf,
    pub binary: PathBuf,
    pub data_dir: PathBuf,
    pub torrc: PathBuf,
    /// Каталог `pt_config.json` и рабочий каталог транспортов.
    pub pt_dir: PathBuf,
    pub geoip: PathBuf,
    pub geoip6: PathBuf,
    /// Android: tor и транспорты — в каталоге библиотек APK (`None` — бандл
    /// на компьютере).
    pub native_libs: Option<PathBuf>,
}

impl TorPaths {
    /// Бандл, распакованный в `root` (компьютер).
    pub fn from_root(root: PathBuf) -> Self {
        let bin_name = if cfg!(windows) { "tor.exe" } else { "tor" };
        Self {
            binary: root.join("tor").join(bin_name),
            data_dir: root.join("data"),
            torrc: root.join("torrc"),
            pt_dir: root.join("tor").join("pluggable_transports"),
            geoip: root.join("data").join("geoip"),
            geoip6: root.join("data").join("geoip6"),
            native_libs: None,
            root,
        }
    }

    /// Tor в APK. Запускать программы Android 10+ разрешает только из
    /// каталога библиотек приложения, поэтому они лежат там под именами
    /// `libtor.so` и `lib<транспорт>.so`; `pt_config.json` — в `root`.
    /// GeoIP клиенту не нужен, в APK его нет.
    pub fn android(root: PathBuf, native_libs: PathBuf) -> Self {
        Self {
            binary: native_libs.join("libtor.so"),
            data_dir: root.join("data"),
            torrc: root.join("torrc"),
            pt_dir: root.clone(),
            geoip: root.join("data").join("geoip"),
            geoip6: root.join("data").join("geoip6"),
            native_libs: Some(native_libs),
            root,
        }
    }

    /// Файл программы транспорта (`lyrebird` из pt_config).
    pub fn pt_program(&self, program: &str) -> PathBuf {
        match &self.native_libs {
            Some(dir) => dir.join(format!("lib{program}.so")),
            None => self.pt_dir.join(program),
        }
    }

    /// Программа транспорта для `ClientTransportPlugin`. Tor режет значение
    /// по пробелам и кавычек не понимает, а на macOS данные приложения лежат
    /// в `Application Support` — с пробелом, поэтому у бандла путь
    /// относительный (рабочий каталог tor — его каталог, `process::spawn`).
    /// Каталог библиотек Android без пробелов — путь полный.
    pub fn pt_torrc_exec(&self, program: &str) -> String {
        match &self.native_libs {
            Some(_) => self.pt_program(program).to_string_lossy().into_owned(),
            None => format!("{}{program}", crate::pt_config::PT_DIR_REL),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Снимок уходит во фронт (stores/tor-store.ts): статусы и мосты строчными,
    /// поля в snake_case. Расхождение молча сломало бы индикатор Tor.
    #[test]
    fn snapshot_serializes_to_the_frontend_contract() {
        let state = TorState {
            status: TorStatus::Bootstrapping,
            bootstrap_pct: 45,
            message: Some("Loading relay descriptors".into()),
            use_bridges: true,
            bridge_kind: BridgeKind::Auto,
            active_transport: Some("webtunnel".into()),
            attempt: 2,
            country: Some("ru".into()),
            stalled: true,
            error_code: Some(TorErrorCode::AllMethodsFailed),
            active_bridges: vec!["webtunnel [2001:db8::1]:443 url=https://x".into()],
            ..TorState::default()
        };
        assert_eq!(
            serde_json::to_value(state.snapshot()).unwrap(),
            json!({
                "status": "bootstrapping",
                "bootstrap_pct": 45,
                "message": "Loading relay descriptors",
                "socks_port": 9250,
                "control_port": 9251,
                "use_bridges": true,
                "bridge_kind": "auto",
                "active_transport": "webtunnel",
                "attempt": 2,
                "country": "ru",
                "stalled": true,
                "fetching_bridges": false,
                "error_code": "all_methods_failed",
                "http_tunnel_port": null,
            })
        );
    }

    #[test]
    fn every_status_and_bridge_kind_is_lowercase() {
        let statuses = [
            (TorStatus::Off, "off"),
            (TorStatus::Installing, "installing"),
            (TorStatus::Starting, "starting"),
            (TorStatus::Bootstrapping, "bootstrapping"),
            (TorStatus::Ready, "ready"),
            (TorStatus::Failed, "failed"),
        ];
        for (status, name) in statuses {
            assert_eq!(serde_json::to_value(status).unwrap(), json!(name));
        }
        for (kind, name) in [
            (BridgeKind::None, "none"),
            (BridgeKind::Auto, "auto"),
            (BridgeKind::Snowflake, "snowflake"),
            (BridgeKind::Obfs4, "obfs4"),
            (BridgeKind::Meek, "meek"),
            (BridgeKind::Custom, "custom"),
        ] {
            assert_eq!(serde_json::to_value(kind).unwrap(), json!(name));
            let back: BridgeKind = serde_json::from_value(json!(name)).unwrap();
            assert_eq!(back, kind);
        }
    }

    #[test]
    fn default_state_is_off_without_bridges_and_pid() {
        let state = TorState::default();
        assert_eq!(state.status, TorStatus::Off);
        assert_eq!(state.child_pid, None);
        assert!(!state.use_bridges);
        assert!(state.custom_bridges.is_empty());
        assert!(state.active_bridges.is_empty());
        assert!(!state.keep_going);
    }

    #[test]
    fn paths_follow_the_expert_bundle_layout() {
        let root = std::path::PathBuf::from("/tmp/tor-root");
        let paths = TorPaths::from_root(root.clone());
        let bin = if cfg!(windows) { "tor.exe" } else { "tor" };
        assert_eq!(paths.binary, root.join("tor").join(bin));
        assert_eq!(paths.pt_dir, root.join("tor").join("pluggable_transports"));
        assert_eq!(paths.geoip, root.join("data").join("geoip"));
        assert_eq!(paths.geoip6, root.join("data").join("geoip6"));
        assert_eq!(paths.torrc, root.join("torrc"));
        assert_eq!(paths.data_dir, root.join("data"));
        assert_eq!(paths.pt_program("lyrebird"), paths.pt_dir.join("lyrebird"));
    }

    #[test]
    fn android_runs_tor_and_transports_from_the_library_dir() {
        let root = PathBuf::from("/data/user/0/com.bastyon.app/files/tor");
        let libs = PathBuf::from("/data/app/~~Ab3==/com.bastyon.app-Xy_9==/lib/arm64");
        let paths = TorPaths::android(root.clone(), libs.clone());
        assert_eq!(paths.binary, libs.join("libtor.so"));
        assert_eq!(paths.pt_program("lyrebird"), libs.join("liblyrebird.so"));
        assert_eq!(
            paths.pt_torrc_exec("lyrebird"),
            "/data/app/~~Ab3==/com.bastyon.app-Xy_9==/lib/arm64/liblyrebird.so"
        );
        assert_eq!(paths.pt_dir, root);
        assert_eq!(paths.data_dir, root.join("data"));
        assert_eq!(paths.torrc, root.join("torrc"));
    }
}
