use crate::tor::state::TorPaths;
use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use tar::Archive;
use tauri::{AppHandle, Emitter, Runtime};
use thiserror::Error;

/// Закреплённый tor-expert-bundle: версия и SHA-256 архивов по платформам.
/// Хэши взяты из `sha256sums-signed-build.txt`, подпись которого проверена
/// ключом Tor Browser Developers (`scripts/tor-bundle-pin.sh <версия>`). Тот
/// же файл читает release.yml, когда кладёт архивы в зеркало на GitHub.
const BUNDLE_JSON: &str = include_str!("bundle.json");

const ARCHIVE_BASE: &str = "https://archive.torproject.org/tor-package-archive/torbrowser";
const DIST_BASE: &str = "https://dist.torproject.org/torbrowser";
/// Релиз `tor-<версия>` этого репозитория — зеркало архивов (джоба `tor-mirror`
/// в release.yml). Пока его нет, GitHub отвечает 404 и архив берётся с
/// torproject.org.
const MIRROR_REPO: &str = "Vakutaghin/bastyon-nextgen";

/// Версия бандла, с которой распакован `tor/`. Другая или нет файла — бандл
/// ставится заново: раньше установленный Tor не обновлялся никогда.
const VERSION_MARKER: &str = ".bundle-version";

#[derive(Debug, Deserialize)]
struct BundlePin {
    version: String,
    sha256: BTreeMap<String, String>,
}

fn pin() -> &'static BundlePin {
    static PIN: OnceLock<BundlePin> = OnceLock::new();
    PIN.get_or_init(|| serde_json::from_str(BUNDLE_JSON).expect("tor/bundle.json is valid"))
}

/// Версия закреплённого бандла (= версия Tor Browser, из которого он взят).
pub fn tor_version() -> &'static str {
    &pin().version
}

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
    #[error("expected file missing after extraction: {0}")]
    ExtractedFileMissing(String),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("installation cancelled")]
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct PlatformInfo {
    /// Filename within the version directory.
    pub archive_name: String,
    /// Ожидаемый SHA-256 архива из `bundle.json`.
    pub sha256: String,
    /// Whether the archive is a `.zip` (legacy Windows) or `.tar.gz` (default).
    pub is_zip: bool,
}

pub fn detect_platform() -> Result<PlatformInfo, InstallError> {
    platform_for(std::env::consts::OS, std::env::consts::ARCH)
}

fn platform_for(os: &str, arch: &str) -> Result<PlatformInfo, InstallError> {
    let (platform, arch_tag) = match (os, arch) {
        ("windows", "x86_64") => ("windows", "x86_64"),
        ("windows", "x86") => ("windows", "i686"),
        ("linux", "x86_64") => ("linux", "x86_64"),
        ("linux", "x86") => ("linux", "i686"),
        ("macos", "x86_64") => ("macos", "x86_64"),
        ("macos", "aarch64") => ("macos", "aarch64"),
        _ => {
            return Err(InstallError::UnsupportedPlatform(format!(
                "{}-{}",
                os, arch
            )))
        }
    };
    let key = format!("{}-{}", platform, arch_tag);
    // Для Linux ARM Tor Project бандл не собирает — хэша нет, ставить нечего.
    let sha256 = pin()
        .sha256
        .get(&key)
        .ok_or_else(|| InstallError::UnsupportedPlatform(key.clone()))?
        .to_lowercase();

    Ok(PlatformInfo {
        archive_name: format!("tor-expert-bundle-{}-{}.tar.gz", key, tor_version()),
        sha256,
        is_zip: false,
    })
}

/// Откуда качать архив, по порядку. Первым — зеркало в релизах этого
/// репозитория: torproject.org в РФ заблокирован с 2021 года, а GitHub
/// открывается. Подлинность держит закреплённый хэш, а не источник.
fn archive_urls(version: &str, archive_name: &str) -> Vec<String> {
    vec![
        format!(
            "https://github.com/{}/releases/download/tor-{}/{}",
            MIRROR_REPO, version, archive_name
        ),
        format!("{}/{}/{}", ARCHIVE_BASE, version, archive_name),
        format!("{}/{}/{}", DIST_BASE, version, archive_name),
    ]
}

/// Бандл распакован и той же версии, что закреплена.
pub fn is_installed(paths: &TorPaths) -> bool {
    let marker = paths.binary.with_file_name(VERSION_MARKER);
    has_bundle(paths) && fs::read_to_string(marker).is_ok_and(|v| v.trim() == tor_version())
}

/// Бандл распакован, пусть и другой версии: Tor из него запустится.
pub fn has_bundle(paths: &TorPaths) -> bool {
    paths.binary.is_file() && paths.geoip.is_file()
}

/// Версия распакованного бандла (пусто — распакован до маркера версии).
pub fn installed_version(paths: &TorPaths) -> Option<String> {
    has_bundle(paths).then(|| {
        fs::read_to_string(paths.binary.with_file_name(VERSION_MARKER))
            .map(|v| v.trim().to_string())
            .unwrap_or_default()
    })
}

/// Приложение обновилось и закрепило другой Tor, а стоит прежний: он работает,
/// пока закреплённый скачивается через него в фоне (`download_upgrade`).
pub fn upgrade_pending(paths: &TorPaths) -> bool {
    !is_installed(paths) && has_bundle(paths)
}

/// Бандл готов к запуску: закреплённый, а пока он не скачан — прежний.
///
/// Раньше прежний бандл сносился и закреплённый качался прямо при включении
/// Tor: после обновления приложения Tor скачивался заново, а если скачать не
/// выходило (адрес заблокирован, сеть плохая), не включался вовсе.
///
/// Скачанный архив ставится здесь, поэтому звать — только когда tor не
/// запущен: работающий tor.exe на Windows не заменить.
pub async fn ensure_installed<R: Runtime>(
    app: &AppHandle<R>,
    paths: &TorPaths,
    cancel: &AtomicBool,
) -> Result<(), InstallError> {
    if is_installed(paths) {
        return Ok(());
    }
    install_platform(app, paths, &detect_platform()?, cancel).await
}

async fn install_platform<R: Runtime>(
    app: &AppHandle<R>,
    paths: &TorPaths,
    platform: &PlatformInfo,
    cancel: &AtomicBool,
) -> Result<(), InstallError> {
    fs::create_dir_all(&paths.root)?;
    fs::create_dir_all(&paths.data_dir)?;

    let archive_path = paths.root.join(&platform.archive_name);

    // Архив скачан в фоне или остался от прерванной распаковки — ставим без сети.
    if archive_path.is_file() {
        match check_sha256(&archive_path, &platform.sha256) {
            Ok(()) => return unpack(app, paths, platform, &archive_path),
            Err(e) => {
                log::warn!("[tor] stored archive rejected: {}", e);
                let _ = fs::remove_file(&archive_path);
            }
        }
    }
    if has_bundle(paths) {
        log::info!(
            "[tor] using the installed bundle until {} is downloaded",
            tor_version()
        );
        return Ok(());
    }

    // Зеркало по очереди: недоступно, 404 или хэш не тот — следующее.
    let mut last_err: Option<InstallError> = None;
    let mut verified = false;
    for url in archive_urls(tor_version(), &platform.archive_name) {
        emit_progress(app, "starting", 0.0, &format!("Downloading {}", platform.archive_name));
        match download_with_progress(app, &url, &archive_path, cancel).await {
            Ok(()) => {}
            Err(InstallError::Cancelled) => return Err(InstallError::Cancelled),
            Err(e) => {
                log::warn!("[tor] download from {} failed: {}", url, e);
                let _ = fs::remove_file(&archive_path);
                last_err = Some(e);
                continue;
            }
        }
        if cancel.load(Ordering::SeqCst) {
            let _ = fs::remove_file(&archive_path);
            return Err(InstallError::Cancelled);
        }

        emit_progress(app, "verifying", 0.95, "Verifying SHA256");
        match check_sha256(&archive_path, &platform.sha256) {
            Ok(()) => {
                verified = true;
                break;
            }
            Err(e) => {
                log::warn!("[tor] archive from {} rejected: {}", url, e);
                let _ = fs::remove_file(&archive_path);
                last_err = Some(e);
            }
        }
    }
    if !verified {
        return Err(last_err.unwrap_or(InstallError::ExtractedFileMissing(
            platform.archive_name.clone(),
        )));
    }
    unpack(app, paths, platform, &archive_path)
}

/// Проверенный архив — на место прежнего бандла. Архив удаляется последним,
/// после метки версии: прерванная распаковка повторится из него.
fn unpack<R: Runtime>(
    app: &AppHandle<R>,
    paths: &TorPaths,
    platform: &PlatformInfo,
    archive_path: &Path,
) -> Result<(), InstallError> {
    emit_progress(app, "extracting", 0.97, "Extracting bundle");
    // Каталог прошлой версии — целиком: в 15.x нет отдельного
    // snowflake-client, и старые бинарники не должны оставаться рядом.
    if let Some(tor_dir) = paths.binary.parent() {
        let _ = fs::remove_dir_all(tor_dir);
    }
    if platform.is_zip {
        extract_zip(archive_path, &paths.root)?;
    } else {
        extract_tar_gz(archive_path, &paths.root)?;
    }

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

    fs::write(paths.binary.with_file_name(VERSION_MARKER), tor_version())?;
    let _ = fs::remove_file(archive_path);
    let _ = fs::remove_file(part_path(archive_path));

    emit_progress(app, "ready", 1.0, "Tor installed");
    Ok(())
}

/// Пауза без единого байта, после которой фоновая загрузка считается оборванной.
const UPGRADE_STALL: Duration = Duration::from_secs(60);

fn part_path(archive_path: &Path) -> std::path::PathBuf {
    let mut name = archive_path.as_os_str().to_owned();
    name.push(".part");
    name.into()
}

/// Скачать закреплённый бандл, не трогая работающий: он встанет при следующем
/// включении Tor (`ensure_installed`). `client` ходит через сам Tor: прямой
/// адрес может быть заблокирован, а запрос мимо Tor выдал бы, что здесь Tor.
pub async fn download_upgrade(
    client: &reqwest::Client,
    paths: &TorPaths,
) -> Result<(), InstallError> {
    let platform = detect_platform()?;
    let dest = paths.root.join(&platform.archive_name);
    if dest.is_file() {
        return Ok(());
    }
    let part = part_path(&dest);
    let mut last_err: Option<InstallError> = None;
    for url in archive_urls(tor_version(), &platform.archive_name) {
        let result = match fetch_to(client, &url, &part).await {
            Ok(()) => check_sha256(&part, &platform.sha256),
            Err(e) => Err(e),
        };
        match result {
            Ok(()) => {
                fs::rename(&part, &dest)?;
                return Ok(());
            }
            Err(e) => {
                log::warn!("[tor] upgrade from {} failed: {}", url, e);
                let _ = fs::remove_file(&part);
                last_err = Some(e);
            }
        }
    }
    Err(last_err.unwrap_or(InstallError::ExtractedFileMissing(platform.archive_name)))
}

async fn fetch_to(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), InstallError> {
    let resp = client.get(url).send().await?.error_for_status()?;
    let mut file = fs::File::create(dest)?;
    let mut stream = resp.bytes_stream();
    loop {
        match tokio::time::timeout(UPGRADE_STALL, stream.next()).await {
            Err(_) => {
                return Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "stalled").into())
            }
            Ok(None) => break,
            Ok(Some(chunk)) => file.write_all(&chunk?)?,
        }
    }
    file.flush()?;
    Ok(())
}

async fn download_with_progress<R: Runtime>(
    app: &AppHandle<R>,
    url: &str,
    dest: &Path,
    cancel: &AtomicBool,
) -> Result<(), InstallError> {
    // Заблокированный адрес в РФ чаще молчит, чем отказывает: без
    // connect_timeout следующее зеркало ждало бы общие 10 минут.
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(600))
        .build()?;
    let resp = client.get(url).send().await?.error_for_status()?;
    let total = resp.content_length().unwrap_or(0);

    let mut file = fs::File::create(dest)?;
    let mut downloaded: u64 = 0;
    let mut last_emit: f32 = -1.0;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        // `tor_stop` во время загрузки: бросаем архив, не дописываем (S59).
        if cancel.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(dest);
            return Err(InstallError::Cancelled);
        }
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

/// SHA-256 файла совпадает с ожидаемым (в нижнем регистре hex).
fn check_sha256(archive_path: &Path, expected: &str) -> Result<(), InstallError> {
    let mut hasher = Sha256::new();
    let mut f = fs::File::open(archive_path)?;
    std::io::copy(&mut f, &mut hasher)?;
    let actual = hex::encode(hasher.finalize());

    if actual != expected {
        return Err(InstallError::HashMismatch {
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

fn emit_progress<R: Runtime>(app: &AppHandle<R>, phase: &str, fraction: f32, message: &str) {
    let _ = app.emit(
        "tor:install-progress",
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
    use crate::tor::state::TorPaths;
    use std::path::PathBuf;

    /// Свой каталог в temp на каждый тест; стирается при выходе из области.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let dir = std::env::temp_dir().join(format!(
                "bastyon-tor-test-{}-{}-{}",
                tag,
                std::process::id(),
                nanos
            ));
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    const NAME: &str = "tor-expert-bundle-linux-x86_64-15.0.25.tar.gz";

    #[test]
    fn platform_archive_name_is_pinned_to_the_version() {
        let platform = detect_platform().expect("CI and dev hosts are supported");
        assert!(platform.archive_name.starts_with("tor-expert-bundle-"));
        assert!(platform
            .archive_name
            .ends_with(&format!("-{}.tar.gz", tor_version())));
        assert_eq!(platform.sha256.len(), 64);
        assert!(!platform.is_zip);
    }

    /// Каждая сборка релиза (macOS обе, Windows, Linux) должна найти свой хэш,
    /// иначе Tor на ней не поставится вовсе.
    #[test]
    fn every_release_platform_has_a_pinned_hash() {
        for (os, arch) in [
            ("macos", "aarch64"),
            ("macos", "x86_64"),
            ("windows", "x86_64"),
            ("linux", "x86_64"),
        ] {
            let p = platform_for(os, arch).unwrap_or_else(|e| panic!("{os}-{arch}: {e}"));
            assert!(
                p.sha256.len() == 64 && p.sha256.chars().all(|c| c.is_ascii_hexdigit()),
                "{os}-{arch}: {}",
                p.sha256
            );
        }
        assert!(matches!(
            platform_for("linux", "aarch64"),
            Err(InstallError::UnsupportedPlatform(_))
        ));
    }

    #[test]
    fn github_mirror_is_tried_before_torproject() {
        let urls = archive_urls("15.0.25", NAME);
        assert_eq!(
            urls[0],
            format!("https://github.com/Vakutaghin/bastyon-nextgen/releases/download/tor-15.0.25/{NAME}")
        );
        assert!(urls[1].starts_with("https://archive.torproject.org/"));
        assert!(urls.iter().all(|u| u.ends_with(NAME)));
    }

    /// Бандл прошлой версии (14.0.7 без файла версии) — не закреплённый: его
    /// заменит новый, а до тех пор он работает.
    #[test]
    fn installed_bundle_of_another_version_is_reinstalled() {
        let dir = TempDir::new("marker");
        let paths = TorPaths::from_root(dir.0.clone());
        fs::create_dir_all(paths.binary.parent().unwrap()).unwrap();
        fs::create_dir_all(&paths.data_dir).unwrap();
        fs::write(&paths.binary, b"tor").unwrap();
        fs::write(&paths.geoip, b"geo").unwrap();
        assert!(!is_installed(&paths), "no marker = old bundle");

        let marker = paths.binary.with_file_name(VERSION_MARKER);
        fs::write(&marker, "14.0.7").unwrap();
        assert!(!is_installed(&paths));

        fs::write(&marker, format!("{}\n", tor_version())).unwrap();
        assert!(is_installed(&paths));
        assert!(!upgrade_pending(&paths));
    }

    /// Бандл как у Tor Project: `tor/`, транспорты и `data/geoip*`.
    fn write_bundle(archive: &Path, body: &[u8]) {
        let gz = flate2::write::GzEncoder::new(
            fs::File::create(archive).unwrap(),
            flate2::Compression::fast(),
        );
        let mut tar = tar::Builder::new(gz);
        let bin_name = if cfg!(windows) { "tor.exe" } else { "tor" };
        for (path, body) in [
            (format!("tor/{bin_name}"), body),
            ("tor/pluggable_transports/lyrebird".to_string(), &b"pt"[..]),
            ("data/geoip".to_string(), &b"geo"[..]),
            ("data/geoip6".to_string(), &b"geo6"[..]),
        ] {
            let mut header = tar::Header::new_gnu();
            header.set_size(body.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar.append_data(&mut header, path, body).unwrap();
        }
        tar.into_inner().unwrap().finish().unwrap();
    }

    /// Бандл прежней версии без метки, со старым `snowflake-client`.
    fn old_bundle(dir: &TempDir) -> TorPaths {
        let paths = TorPaths::from_root(dir.0.join("tor-root"));
        fs::create_dir_all(&paths.pt_dir).unwrap();
        fs::create_dir_all(&paths.data_dir).unwrap();
        fs::write(&paths.binary, b"old tor").unwrap();
        fs::write(paths.pt_dir.join("snowflake-client"), b"old").unwrap();
        fs::write(&paths.geoip, b"geo").unwrap();
        paths
    }

    fn install_offline(paths: &TorPaths, platform: &PlatformInfo) -> Result<(), InstallError> {
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!(test = true))
            .expect("mock app");
        let handle = app.handle().clone();
        tauri::async_runtime::block_on(install_platform(
            &handle,
            paths,
            platform,
            &AtomicBool::new(false),
        ))
    }

    fn fake_platform(archive_name: &str, sha256: String) -> PlatformInfo {
        PlatformInfo {
            archive_name: archive_name.to_string(),
            sha256,
            is_zip: false,
        }
    }

    /// После обновления приложения прежний Tor запускается сразу, без сети:
    /// раньше его сносили и качали новый прямо при включении.
    #[test]
    fn previous_bundle_keeps_working_until_the_new_one_is_downloaded() {
        let dir = TempDir::new("keep");
        let paths = old_bundle(&dir);
        assert!(upgrade_pending(&paths));

        // Хэш, которому не совпасть: дошло бы до сети — упало бы.
        install_offline(&paths, &fake_platform(NAME, "0".repeat(64))).expect("old bundle used");

        assert_eq!(fs::read(&paths.binary).unwrap(), b"old tor");
        assert!(
            upgrade_pending(&paths),
            "the new version is still to download"
        );
    }

    /// Скачанный в фоне архив ставится при следующем запуске, без сети.
    #[test]
    fn downloaded_upgrade_installs_on_the_next_start() {
        let dir = TempDir::new("apply");
        let paths = old_bundle(&dir);
        let archive = paths.root.join(NAME);
        write_bundle(&archive, b"new tor");
        let sha = hex::encode(Sha256::digest(fs::read(&archive).unwrap()));

        install_offline(&paths, &fake_platform(NAME, sha)).expect("install");

        assert_eq!(fs::read(&paths.binary).unwrap(), b"new tor");
        assert!(is_installed(&paths));
        assert!(!archive.exists(), "the archive is removed once installed");
        assert!(
            !paths.pt_dir.join("snowflake-client").exists(),
            "old binaries removed"
        );
    }

    /// Битый архив не ставится и не мешает прежнему бандлу.
    #[test]
    fn corrupt_downloaded_archive_is_dropped() {
        let dir = TempDir::new("corrupt");
        let paths = old_bundle(&dir);
        let archive = paths.root.join(NAME);
        fs::write(&archive, b"truncated").unwrap();

        install_offline(&paths, &fake_platform(NAME, "0".repeat(64))).expect("old bundle used");

        assert!(!archive.exists());
        assert_eq!(fs::read(&paths.binary).unwrap(), b"old tor");
    }

    /// Живая установка поверх старой: `BASTYON_TOR_INSTALL_ROOT=<пустой каталог
    /// или с бандлом 14.x> cargo test --lib live_install -- --ignored --nocapture`.
    /// Качает ~20 МБ: зеркало GitHub, при 404 — torproject.org.
    #[test]
    #[ignore]
    fn live_install() {
        let root = PathBuf::from(std::env::var("BASTYON_TOR_INSTALL_ROOT").expect("root"));
        let paths = TorPaths::from_root(root);
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!(test = true))
            .expect("mock app");
        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            ensure_installed(&handle, &paths, &AtomicBool::new(false))
                .await
                .expect("install");
            assert!(is_installed(&paths));
            assert!(paths.pt_dir.join("pt_config.json").is_file());
            assert!(!paths.pt_dir.join("snowflake-client").exists(), "old binary removed");
        });
    }

    /// Живое обновление поверх прежнего бандла: `BASTYON_TOR_INSTALL_ROOT=<каталог
    /// с бандлом 14.x> cargo test --lib live_upgrade -- --ignored --nocapture`.
    /// Прежний запускается без сети, новый качается (здесь — напрямую, в
    /// приложении — через Tor) и встаёт при следующем запуске.
    #[test]
    #[ignore]
    fn live_upgrade() {
        let root = PathBuf::from(std::env::var("BASTYON_TOR_INSTALL_ROOT").expect("root"));
        let paths = TorPaths::from_root(root);
        assert!(upgrade_pending(&paths), "needs a bundle of another version");
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!(test = true))
            .expect("mock app");
        let handle = app.handle().clone();
        tauri::async_runtime::block_on(async move {
            ensure_installed(&handle, &paths, &AtomicBool::new(false))
                .await
                .expect("old bundle");
            assert!(upgrade_pending(&paths), "nothing downloaded at start");

            download_upgrade(&reqwest::Client::new(), &paths)
                .await
                .expect("download");
            assert!(upgrade_pending(&paths), "the running bundle is not touched");

            ensure_installed(&handle, &paths, &AtomicBool::new(false))
                .await
                .expect("install");
            assert!(is_installed(&paths));
            assert!(
                !paths.pt_dir.join("snowflake-client").exists(),
                "old binary removed"
            );
        });
    }

    #[test]
    fn archive_hash_must_match() {
        let dir = TempDir::new("sha");
        let file = dir.0.join(NAME);
        fs::write(&file, b"tor bundle bytes").unwrap();
        let good = hex::encode(Sha256::digest(b"tor bundle bytes"));

        assert!(check_sha256(&file, &good).is_ok());
        match check_sha256(&file, &"0".repeat(64)) {
            Err(InstallError::HashMismatch { expected, actual }) => {
                assert_eq!(expected, "0".repeat(64));
                assert_eq!(actual, good);
            }
            other => panic!("expected HashMismatch, got {other:?}"),
        }
    }

    #[test]
    fn extracted_bundle_matches_tor_paths() {
        let dir = TempDir::new("tar");
        let archive = dir.0.join(NAME);
        {
            let gz = flate2::write::GzEncoder::new(
                fs::File::create(&archive).unwrap(),
                flate2::Compression::fast(),
            );
            let mut tar = tar::Builder::new(gz);
            let bin_name = if cfg!(windows) { "tor.exe" } else { "tor" };
            for (path, body) in [
                (format!("tor/{bin_name}"), &b"binary"[..]),
                ("tor/pluggable_transports/lyrebird".to_string(), &b"pt"[..]),
                ("data/geoip".to_string(), &b"geo"[..]),
                ("data/geoip6".to_string(), &b"geo6"[..]),
            ] {
                let mut header = tar::Header::new_gnu();
                header.set_size(body.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                tar.append_data(&mut header, path, body).unwrap();
            }
            tar.into_inner().unwrap().finish().unwrap();
        }

        let root = dir.0.join("tor-root");
        fs::create_dir_all(&root).unwrap();
        extract_tar_gz(&archive, &root).unwrap();

        let paths = TorPaths::from_root(root);
        assert_eq!(fs::read(&paths.binary).unwrap(), b"binary");
        assert!(paths.geoip.is_file());
        assert!(paths.geoip6.is_file());
        assert!(paths.pt_dir.join("lyrebird").is_file());
    }

    #[test]
    fn zip_entries_cannot_escape_the_destination() {
        let dir = TempDir::new("zip");
        let archive = dir.0.join("bundle.zip");
        {
            let mut zip = zip::ZipWriter::new(fs::File::create(&archive).unwrap());
            let options: zip::write::SimpleFileOptions = Default::default();
            zip.start_file("tor/tor.exe", options).unwrap();
            zip.write_all(b"exe").unwrap();
            zip.start_file("../escaped.txt", options).unwrap();
            zip.write_all(b"nope").unwrap();
            zip.finish().unwrap();
        }

        let dest = dir.0.join("out");
        fs::create_dir_all(&dest).unwrap();
        extract_zip(&archive, &dest).unwrap();

        assert_eq!(fs::read(dest.join("tor").join("tor.exe")).unwrap(), b"exe");
        assert!(!dir.0.join("escaped.txt").exists());
    }
}
