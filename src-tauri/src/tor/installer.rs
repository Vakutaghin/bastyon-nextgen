use crate::tor::state::TorPaths;
use flate2::read::GzDecoder;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::Path;
use tar::Archive;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Pinned tor-expert-bundle version. Bump to upgrade Tor.
/// Releases: https://archive.torproject.org/tor-package-archive/torbrowser/
pub const TOR_VERSION: &str = "14.0.7";

const ARCHIVE_BASE: &str = "https://archive.torproject.org/tor-package-archive/torbrowser";

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("unsupported platform: {0}")]
    UnsupportedPlatform(String),
    #[error("SHA256 mismatch: expected {expected}, got {actual}")]
    HashMismatch { expected: String, actual: String },
    #[error("SHA256 manifest did not contain entry for {0}")]
    HashMissing(String),
    #[error("expected file missing after extraction: {0}")]
    ExtractedFileMissing(String),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

#[derive(Debug, Clone)]
pub struct PlatformInfo {
    /// Filename within the version directory.
    pub archive_name: String,
    /// Whether the archive is a `.zip` (legacy Windows) or `.tar.gz` (default).
    pub is_zip: bool,
}

pub fn detect_platform() -> Result<PlatformInfo, InstallError> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let (platform, arch_tag) = match (os, arch) {
        ("windows", "x86_64") => ("windows", "x86_64"),
        ("windows", "x86") => ("windows", "i686"),
        ("linux", "x86_64") => ("linux", "x86_64"),
        ("linux", "x86") => ("linux", "i686"),
        ("linux", "aarch64") => ("linux", "aarch64"),
        ("linux", "arm") => ("linux", "armhf"),
        ("macos", "x86_64") => ("macos", "x86_64"),
        ("macos", "aarch64") => ("macos", "aarch64"),
        _ => {
            return Err(InstallError::UnsupportedPlatform(format!(
                "{}-{}",
                os, arch
            )))
        }
    };

    let archive_name = format!(
        "tor-expert-bundle-{}-{}-{}.tar.gz",
        platform, arch_tag, TOR_VERSION
    );

    Ok(PlatformInfo {
        archive_name,
        is_zip: false,
    })
}

/// Top-level: ensure Tor binary and resources exist on disk. No-op if installed.
pub async fn ensure_installed(
    app: &AppHandle,
    paths: &TorPaths,
) -> Result<(), InstallError> {
    if paths.binary.is_file() && paths.geoip.is_file() {
        return Ok(());
    }

    fs::create_dir_all(&paths.root)?;
    fs::create_dir_all(&paths.data_dir)?;

    let platform = detect_platform()?;

    emit_progress(app, "starting", 0.0, &format!("Downloading {}", platform.archive_name));

    let archive_url = format!(
        "{}/{}/{}",
        ARCHIVE_BASE, TOR_VERSION, platform.archive_name
    );
    let sha_url = format!(
        "{}/{}/sha256sums-signed-build.txt",
        ARCHIVE_BASE, TOR_VERSION
    );

    let archive_path = paths.root.join(&platform.archive_name);

    download_with_progress(app, &archive_url, &archive_path).await?;

    emit_progress(app, "verifying", 0.95, "Verifying SHA256");
    verify_sha256(&archive_path, &platform.archive_name, &sha_url).await?;

    emit_progress(app, "extracting", 0.97, "Extracting bundle");
    if platform.is_zip {
        extract_zip(&archive_path, &paths.root)?;
    } else {
        extract_tar_gz(&archive_path, &paths.root)?;
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

        if paths.pt_dir.is_dir() {
            for entry in fs::read_dir(&paths.pt_dir)? {
                let entry = entry?;
                if entry.file_type()?.is_file() {
                    let mut p = entry.metadata()?.permissions();
                    p.set_mode(0o755);
                    fs::set_permissions(entry.path(), p)?;
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("xattr")
            .arg("-dr")
            .arg("com.apple.quarantine")
            .arg(&paths.root)
            .output();
    }

    emit_progress(app, "ready", 1.0, "Tor installed");
    Ok(())
}

async fn download_with_progress(
    app: &AppHandle,
    url: &str,
    dest: &Path,
) -> Result<(), InstallError> {
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
                    &format!("{} / {} bytes", downloaded, total),
                );
            }
        }
    }
    Ok(())
}

async fn verify_sha256(
    archive_path: &Path,
    archive_name: &str,
    sha_url: &str,
) -> Result<(), InstallError> {
    let manifest = reqwest::get(sha_url).await?.error_for_status()?.text().await?;
    let expected = manifest
        .lines()
        .find_map(|line| {
            let mut it = line.split_whitespace();
            let hash = it.next()?;
            let name = it.next()?;
            let bare = name.trim_start_matches('*');
            if bare.ends_with(archive_name) || bare == archive_name {
                Some(hash.to_lowercase())
            } else {
                None
            }
        })
        .ok_or_else(|| InstallError::HashMissing(archive_name.to_string()))?;

    let mut hasher = Sha256::new();
    let mut f = fs::File::open(archive_path)?;
    std::io::copy(&mut f, &mut hasher)?;
    let actual = hex::encode(hasher.finalize());

    if actual != expected {
        return Err(InstallError::HashMismatch { expected, actual });
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

fn emit_progress(app: &AppHandle, phase: &str, fraction: f32, message: &str) {
    let _ = app.emit(
        "tor:install-progress",
        serde_json::json!({
            "phase": phase,
            "fraction": fraction,
            "message": message,
        }),
    );
}
