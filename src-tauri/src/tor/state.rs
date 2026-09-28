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
    Snowflake,
    Obfs4,
    Custom,
}

impl Default for BridgeKind {
    fn default() -> Self {
        BridgeKind::None
    }
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
}

#[derive(Debug)]
pub struct TorState {
    pub status: TorStatus,
    pub bootstrap_pct: u8,
    pub message: Option<String>,
    pub socks_port: u16,
    pub control_port: u16,
    pub child_pid: Option<u32>,
    pub use_bridges: bool,
    pub bridge_kind: BridgeKind,
    pub custom_bridges: Vec<String>,
}

impl Default for TorState {
    fn default() -> Self {
        Self {
            status: TorStatus::Off,
            bootstrap_pct: 0,
            message: None,
            socks_port: 9250,
            control_port: 9251,
            child_pid: None,
            use_bridges: false,
            bridge_kind: BridgeKind::None,
            custom_bridges: Vec::new(),
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
        }
    }
}

pub type SharedTorState = Arc<RwLock<TorState>>;

#[derive(Debug, Clone)]
pub struct TorPaths {
    pub root: PathBuf,
    pub binary: PathBuf,
    pub data_dir: PathBuf,
    pub torrc: PathBuf,
    pub pt_dir: PathBuf,
    pub geoip: PathBuf,
    pub geoip6: PathBuf,
}

impl TorPaths {
    pub fn from_root(root: PathBuf) -> Self {
        let bin_name = if cfg!(windows) { "tor.exe" } else { "tor" };
        Self {
            binary: root.join("tor").join(bin_name),
            data_dir: root.join("data"),
            torrc: root.join("torrc"),
            pt_dir: root.join("tor").join("pluggable_transports"),
            geoip: root.join("data").join("geoip"),
            geoip6: root.join("data").join("geoip6"),
            root,
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
            bridge_kind: BridgeKind::Snowflake,
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
                "bridge_kind": "snowflake",
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
            (BridgeKind::Snowflake, "snowflake"),
            (BridgeKind::Obfs4, "obfs4"),
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
    }
}
