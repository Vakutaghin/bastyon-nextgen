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
