//! Система, на которой запущено приложение, — для сведений, которые человек
//! отправляет в поддержку (src/b-components/messenger/support-report).
//!
//! Вебвью этого не скажет: WebView2 называет и Windows 10, и Windows 11
//! «Windows NT 10.0», а WKWebView на любой macOS пишет «10_15_7». Только
//! название, версия и архитектура: ни имени компьютера, ни пользователя.

use serde::Serialize;

#[derive(Debug, Serialize, PartialEq)]
pub struct SystemInfo {
    /// "windows" | "macos" | "linux" — как `std::env::consts::OS`.
    pub os: &'static str,
    /// Человеческое название: «Windows 11», «macOS 15.5», «Ubuntu 24.04.1 LTS».
    pub name: String,
    /// Номер версии: сборка Windows, версия macOS, ядро Linux.
    pub version: String,
    pub arch: &'static str,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    let (name, version) = name_and_version();
    SystemInfo {
        os: std::env::consts::OS,
        name,
        version,
        arch: std::env::consts::ARCH,
    }
}

#[cfg(windows)]
fn name_and_version() -> (String, String) {
    let v = windows_version::OsVersion::current();
    (
        windows_name(v.major, v.minor, v.build),
        format!("{}.{}.{}", v.major, v.minor, v.build),
    )
}

/// Windows 11 тоже «10.0»: отличается только номером сборки (с 22000).
#[cfg(any(windows, test))]
fn windows_name(major: u32, minor: u32, build: u32) -> String {
    match (major, build) {
        (10, b) if b >= 22000 => "Windows 11".into(),
        (10, _) => "Windows 10".into(),
        _ => format!("Windows {major}.{minor}"),
    }
}

#[cfg(target_os = "macos")]
fn name_and_version() -> (String, String) {
    let v = objc2_foundation::NSProcessInfo::processInfo().operatingSystemVersion();
    let version = format!("{}.{}.{}", v.majorVersion, v.minorVersion, v.patchVersion);
    (
        format!("macOS {}.{}", v.majorVersion, v.minorVersion),
        version,
    )
}

#[cfg(target_os = "linux")]
fn name_and_version() -> (String, String) {
    let release = std::fs::read_to_string("/etc/os-release")
        .or_else(|_| std::fs::read_to_string("/usr/lib/os-release"))
        .unwrap_or_default();
    let name = os_release_name(&release).unwrap_or_else(|| "Linux".into());
    let kernel = std::fs::read_to_string("/proc/sys/kernel/osrelease").unwrap_or_default();
    (name, kernel.trim().to_string())
}

/// PRETTY_NAME из os-release (значения бывают в кавычках и без).
#[cfg(any(target_os = "linux", test))]
fn os_release_name(release: &str) -> Option<String> {
    let line = release
        .lines()
        .find_map(|l| l.strip_prefix("PRETTY_NAME="))?;
    let name = line.trim().trim_matches('"').trim_matches('\'').trim();
    (!name.is_empty()).then(|| name.to_string())
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn name_and_version() -> (String, String) {
    (std::env::consts::OS.to_string(), String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_11_is_told_apart_by_build() {
        assert_eq!(windows_name(10, 0, 19045), "Windows 10");
        assert_eq!(windows_name(10, 0, 22631), "Windows 11");
        assert_eq!(windows_name(6, 3, 9600), "Windows 6.3");
    }

    #[test]
    fn linux_name_comes_from_os_release() {
        let release = "NAME=\"Ubuntu\"\nPRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\nID=ubuntu\n";
        assert_eq!(
            os_release_name(release).as_deref(),
            Some("Ubuntu 24.04.1 LTS")
        );
        assert_eq!(
            os_release_name("PRETTY_NAME=Arch Linux\n").as_deref(),
            Some("Arch Linux")
        );
        assert_eq!(os_release_name("ID=alpine\n"), None);
    }

    #[test]
    fn this_machine_is_described() {
        let info = system_info();
        assert_eq!(info.os, std::env::consts::OS);
        assert!(!info.name.is_empty());
    }
}
