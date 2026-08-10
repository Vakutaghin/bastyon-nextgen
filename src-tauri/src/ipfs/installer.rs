//! Установка бинаря Kubo по требованию: скачивание → сверка запиненного SHA-512
//! → распаковка → chmod → (macOS) ad-hoc-переподпись + снятие quarantine.
//!
//! Отличие от Tor-инсталлятора: SHA-512 запинен КОНСТАНТАМИ в подписанном
//! приложении, а не тянется манифестом. Скачивание+запуск бинаря — это канал RCE;
//! пин защищает от угнанного зеркала (fail-closed при несовпадении).
use crate::ipfs::state::IpfsPaths;
use flate2::read::GzDecoder;
use futures_util::StreamExt;
use sha2::{Digest, Sha512};
use std::fs;
use std::io::Write;
use std::path::Path;
use tar::Archive;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Запиненная версия Kubo. Строка ВКЛЮЧАЕТ ведущий `v`. Bump = обновить и
/// EXPECTED_SHA512 (значения из https://dist.ipfs.tech/kubo/<ver>/<file>.sha512).
pub const KUBO_VERSION: &str = "v0.43.0";

const DIST_BASE: &str = "https://dist.ipfs.tech/kubo";

/// SHA-512 (hex, нижний регистр) артефактов v0.43.0, снятые байт-точно с
/// официального dist-сервера. Ключ — имя архива.
const EXPECTED_SHA512: &[(&str, &str)] = &[
    (
        "kubo_v0.43.0_darwin-amd64.tar.gz",
        "7edd038e9208b8024ef14329102a8bc40827c21337bb2d38ea52400c57a04e3c092086a11c9d342b85083a71df4bf77130fd676bdb68628b2d9e8e6f511ee305",
    ),
    (
        "kubo_v0.43.0_darwin-arm64.tar.gz",
        "2377bc886b340087b20d5a9bdd025e5a6ed4b7e910ac04fa0d0e26f5b7e189b31a33f6cc682c0aaec2695a65b8a38d1f5bfce505c2948c0ea08ee64009034ef6",
    ),
    (
        "kubo_v0.43.0_linux-amd64.tar.gz",
        "6af21cd24a307d94326807b3d3827064c74fb7122f83b6940af250e6ae40da250e0ec0e1f3551256b78cd204623ed56c32ce735bbe28bdcc787b36943c52458a",
    ),
    (
        "kubo_v0.43.0_linux-arm64.tar.gz",
        "aae6c766ec2436f27bbd2d6ab5f8de7d2ced4dc83abc5b54b17bd58a80c28f1ea2e38840305e22f08bd01c55cf8263745675da1bbda2ac0bcde268e9e61e3818",
    ),
    (
        "kubo_v0.43.0_windows-amd64.zip",
        "0486721fc406d36c9d70d16dc3984e70c50d5f1d1c890de3864a6904564080adb3f73546162ad30a8e1ee43024a18bf900fbda2b6c131197351ff2e8b9782178",
    ),
    (
        "kubo_v0.43.0_windows-arm64.zip",
        "6d4bb67ca78219e45bb6375d3d46852e145fd293fe566be03380023d067c9edcccf7887d23bb1ce46152e45177b9a0af282fdd7b8b19a34d5df8fddc58412a75",
    ),
];

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unsupported platform: {0}")]
    UnsupportedPlatform(String),
    #[error("no pinned SHA-512 for {0}")]
    HashMissing(String),
    #[error("SHA-512 mismatch for {name}: expected {expected}, got {actual}")]
    HashMismatch {
        name: String,
        expected: String,
        actual: String,
    },
    #[error("expected file missing after extraction: {0}")]
    ExtractedFileMissing(String),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

#[derive(Debug, Clone)]
pub struct PlatformInfo {
    /// Имя архива в каталоге версии, напр. `kubo_v0.43.0_darwin-arm64.tar.gz`.
    pub archive_name: String,
    /// `.zip` (Windows) против `.tar.gz` (darwin/linux).
    pub is_zip: bool,
}

/// Отображение Rust `OS-ARCH` в Go-токены Kubo. Возвращает (go_os, go_arch, is_zip).
/// 32-битного `386` в v0.43.0 нет ни для одной ОС.
pub fn map_platform(os: &str, arch: &str) -> Option<(&'static str, &'static str, bool)> {
    match (os, arch) {
        ("macos", "x86_64") => Some(("darwin", "amd64", false)),
        ("macos", "aarch64") => Some(("darwin", "arm64", false)),
        ("linux", "x86_64") => Some(("linux", "amd64", false)),
        ("linux", "aarch64") => Some(("linux", "arm64", false)),
        ("windows", "x86_64") => Some(("windows", "amd64", true)),
        ("windows", "aarch64") => Some(("windows", "arm64", true)),
        _ => None,
    }
}

pub fn detect_platform() -> Result<PlatformInfo, InstallError> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let (go_os, go_arch, is_zip) = map_platform(os, arch)
        .ok_or_else(|| InstallError::UnsupportedPlatform(format!("{os}-{arch}")))?;
    let ext = if is_zip { "zip" } else { "tar.gz" };
    let archive_name = format!("kubo_{KUBO_VERSION}_{go_os}-{go_arch}.{ext}");
    Ok(PlatformInfo {
        archive_name,
        is_zip,
    })
}

/// Запиненный SHA-512 для имени архива (None — если такого артефакта нет в таблице).
pub fn expected_sha512(archive_name: &str) -> Option<&'static str> {
    EXPECTED_SHA512
        .iter()
        .find(|(name, _)| *name == archive_name)
        .map(|(_, hash)| *hash)
}

pub fn archive_url(archive_name: &str) -> String {
    format!("{DIST_BASE}/{KUBO_VERSION}/{archive_name}")
}

/// Верхний уровень: гарантировать наличие бинаря kubo. No-op, если уже установлен.
pub async fn ensure_installed(app: &AppHandle, paths: &IpfsPaths) -> Result<(), InstallError> {
    if paths.binary.is_file() {
        return Ok(());
    }

    fs::create_dir_all(&paths.bin_dir)?;

    let platform = detect_platform()?;
    let expected = expected_sha512(&platform.archive_name)
        .ok_or_else(|| InstallError::HashMissing(platform.archive_name.clone()))?;

    emit_progress(
        app,
        "starting",
        0.0,
        &format!("Downloading {}", platform.archive_name),
    );

    let url = archive_url(&platform.archive_name);
    let archive_path = paths.bin_dir.join(&platform.archive_name);
    download_with_progress(app, &url, &archive_path).await?;

    emit_progress(app, "verifying", 0.95, "Verifying SHA-512");
    verify_sha512(&archive_path, &platform.archive_name, expected)?;

    emit_progress(app, "extracting", 0.97, "Extracting Kubo");
    if platform.is_zip {
        extract_zip(&archive_path, &paths.bin_dir)?;
    } else {
        extract_tar_gz(&archive_path, &paths.bin_dir)?;
    }
    let _ = fs::remove_file(&archive_path);

    if !paths.binary.is_file() {
        return Err(InstallError::ExtractedFileMissing(
            paths.binary.to_string_lossy().to_string(),
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = fs::metadata(&paths.binary)?.permissions();
        p.set_mode(0o755);
        fs::set_permissions(&paths.binary, p)?;
    }

    #[cfg(target_os = "macos")]
    {
        // Apple Silicon убивает скачанный неподписанный arm64-бинарь (`Killed: 9`)
        // при exec. Ad-hoc-переподпись снимает это. Best-effort: инструментов
        // может не быть, тогда полагаемся на снятие quarantine ниже.
        let _ = std::process::Command::new("codesign")
            .args(["-s", "-", "-f"])
            .arg(&paths.binary)
            .output();
        let _ = std::process::Command::new("xattr")
            .arg("-dr")
            .arg("com.apple.quarantine")
            .arg(&paths.bin_dir)
            .output();
    }

    write_install_marker(paths, &platform.archive_name);
    emit_progress(app, "ready", 1.0, "Kubo installed");
    Ok(())
}

async fn download_with_progress(app: &AppHandle, url: &str, dest: &Path) -> Result<(), InstallError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()?;
    let resp = client.get(url).send().await?.error_for_status()?;
    let total = resp.content_length().unwrap_or(0);

    let mut file = fs::File::create(dest)?;
    let mut downloaded: u64 = 0;
    let mut last_emit: f32 = -1.0;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = (downloaded as f32 / total as f32) * 0.93;
            if pct - last_emit >= 0.01 {
                last_emit = pct;
                emit_progress(
                    app,
                    "downloading",
                    pct,
                    &format!("{downloaded} / {total} bytes"),
                );
            }
        }
    }
    Ok(())
}

fn verify_sha512(archive_path: &Path, name: &str, expected: &str) -> Result<(), InstallError> {
    let mut hasher = Sha512::new();
    let mut f = fs::File::open(archive_path)?;
    std::io::copy(&mut f, &mut hasher)?;
    let actual = hex::encode(hasher.finalize());

    if actual != expected.to_lowercase() {
        // Fail-closed: не оставляем подозрительный архив на диске.
        let _ = fs::remove_file(archive_path);
        return Err(InstallError::HashMismatch {
            name: name.to_string(),
            expected: expected.to_string(),
            actual,
        });
    }
    Ok(())
}

fn extract_tar_gz(archive: &Path, dest: &Path) -> Result<(), InstallError> {
    let f = fs::File::open(archive)?;
    let gz = GzDecoder::new(f);
    let mut tar = Archive::new(gz);
    tar.unpack(dest)?;
    Ok(())
}

fn extract_zip(archive: &Path, dest: &Path) -> Result<(), InstallError> {
    let f = fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(f)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let outpath = match entry.enclosed_name() {
            Some(p) => dest.join(p),
            None => continue,
        };
        if entry.is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out = fs::File::create(&outpath)?;
            std::io::copy(&mut entry, &mut out)?;
        }
    }
    Ok(())
}

fn write_install_marker(paths: &IpfsPaths, archive_name: &str) {
    let body = serde_json::json!({
        "version": KUBO_VERSION,
        "archive": archive_name,
    });
    let _ = fs::write(&paths.install_marker, body.to_string());
}

fn emit_progress(app: &AppHandle, phase: &str, fraction: f32, message: &str) {
    let _ = app.emit(
        "ipfs:install-progress",
        serde_json::json!({
            "phase": phase,
            "fraction": fraction,
            "message": message,
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_platforms_to_go_tokens() {
        assert_eq!(map_platform("macos", "aarch64"), Some(("darwin", "arm64", false)));
        assert_eq!(map_platform("linux", "x86_64"), Some(("linux", "amd64", false)));
        assert_eq!(map_platform("windows", "x86_64"), Some(("windows", "amd64", true)));
    }

    #[test]
    fn rejects_unsupported_platforms() {
        // 386 не собирается в v0.43.0.
        assert_eq!(map_platform("linux", "x86"), None);
        assert_eq!(map_platform("freebsd", "x86_64"), None);
    }

    #[test]
    fn every_platform_has_a_pinned_hash() {
        for os in ["macos", "linux", "windows"] {
            for arch in ["x86_64", "aarch64"] {
                let (go_os, go_arch, is_zip) = map_platform(os, arch).unwrap();
                let ext = if is_zip { "zip" } else { "tar.gz" };
                let name = format!("kubo_{KUBO_VERSION}_{go_os}-{go_arch}.{ext}");
                assert!(
                    expected_sha512(&name).is_some(),
                    "missing pinned SHA-512 for {name}"
                );
            }
        }
    }

    #[test]
    fn pinned_hashes_are_128_hex_chars() {
        for (name, hash) in EXPECTED_SHA512 {
            assert_eq!(hash.len(), 128, "{name}: bad length");
            assert!(
                hash.chars().all(|c| c.is_ascii_hexdigit()),
                "{name}: non-hex char"
            );
        }
    }

    #[test]
    fn builds_expected_url() {
        assert_eq!(
            archive_url("kubo_v0.43.0_linux-amd64.tar.gz"),
            "https://dist.ipfs.tech/kubo/v0.43.0/kubo_v0.43.0_linux-amd64.tar.gz"
        );
    }
}
