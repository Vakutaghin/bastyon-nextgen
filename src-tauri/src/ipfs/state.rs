use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Грубый статус ноды для UI. Тонкие фазы установки идут отдельным событием
/// `ipfs:install-progress` (как у Tor-модуля).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IpfsStatus {
    /// Не запущено (может быть установлено или нет).
    Off,
    /// Скачивание/проверка/распаковка + `ipfs init`.
    Installing,
    /// Демон запускается, ждём ответа API.
    Starting,
    /// Демон поднят, `gateway_port` валиден.
    Running,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct IpfsStateSnapshot {
    pub status: IpfsStatus,
    pub message: Option<String>,
    /// Порт локального HTTP-gateway (0 пока не Running).
    pub gateway_port: u16,
    /// Бинарь kubo лежит на диске.
    pub installed: bool,
}

#[derive(Debug)]
pub struct IpfsState {
    pub status: IpfsStatus,
    pub message: Option<String>,
    pub api_port: u16,
    pub gateway_port: u16,
    pub child_pid: Option<u32>,
    pub installed: bool,
}

impl Default for IpfsState {
    fn default() -> Self {
        Self {
            status: IpfsStatus::Off,
            message: None,
            api_port: 0,
            gateway_port: 0,
            child_pid: None,
            installed: false,
        }
    }
}

impl IpfsState {
    pub fn snapshot(&self) -> IpfsStateSnapshot {
        IpfsStateSnapshot {
            status: self.status,
            message: self.message.clone(),
            gateway_port: self.gateway_port,
            installed: self.installed,
        }
    }
}

pub type SharedIpfsState = Arc<RwLock<IpfsState>>;

/// Разнесение по каталогам сознательное: бинарь — в перекачиваемый `app_cache_dir`
/// (на Windows не синхронизируется в Roaming, ~80 МБ не гоняются по сети), а
/// repo (IPFS_PATH, кэш блоков) — в `app_data_dir`.
#[derive(Debug, Clone)]
pub struct IpfsPaths {
    /// `app_cache_dir/ipfs` — корень установки бинаря.
    pub bin_dir: PathBuf,
    /// `bin_dir/kubo/ipfs[.exe]` — исполняемый файл (layout архива Kubo).
    pub binary: PathBuf,
    /// `app_data_dir/ipfs/repo` — IPFS_PATH.
    pub repo: PathBuf,
    /// `bin_dir/install.json` — метка версии/хэша установленного бинаря.
    pub install_marker: PathBuf,
}

impl IpfsPaths {
    pub fn new(bin_dir: PathBuf, repo: PathBuf) -> Self {
        let bin_name = if cfg!(windows) { "ipfs.exe" } else { "ipfs" };
        Self {
            binary: bin_dir.join("kubo").join(bin_name),
            install_marker: bin_dir.join("install.json"),
            bin_dir,
            repo,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_path_uses_kubo_layout() {
        let p = IpfsPaths::new(PathBuf::from("/cache/ipfs"), PathBuf::from("/data/ipfs/repo"));
        let expected_bin = if cfg!(windows) { "ipfs.exe" } else { "ipfs" };
        assert!(p.binary.ends_with(format!("kubo/{expected_bin}")));
        assert!(p.install_marker.ends_with("install.json"));
    }

    #[test]
    fn default_state_is_off_and_uninstalled() {
        let st = IpfsState::default();
        assert_eq!(st.status, IpfsStatus::Off);
        assert!(!st.installed);
        assert_eq!(st.gateway_port, 0);
    }
}
