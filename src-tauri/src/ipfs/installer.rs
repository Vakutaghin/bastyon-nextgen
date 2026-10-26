//! Установка бинаря Kubo по требованию: скачивание → сверка запиненного SHA-512
//! → распаковка → chmod → (macOS) ad-hoc-переподпись + снятие quarantine.
//!
//! Отличие от Tor-инсталлятора: SHA-512 запинен в подписанном приложении
//! (`kubo.json` вкомпилирован), а не тянется манифестом. Скачивание+запуск
//! бинаря — это канал RCE; пин защищает от угнанного зеркала (fail-closed при
//! несовпадении), поэтому источников несколько и любой из них годится.
use crate::ipfs::state::IpfsPaths;
use flate2::read::GzDecoder;
use futures_util::{Stream, StreamExt};
use serde::Deserialize;
use sha2::{Digest, Sha512};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;
use tar::Archive;
use tauri::{AppHandle, Emitter, Runtime};
use thiserror::Error;
use tokio::sync::watch;

/// Запиненный Kubo: версия (с ведущим `v`) и SHA-512 архивов (hex, нижний
/// регистр, ключ — имя архива), снятые байт-точно с dist.ipfs.tech. Bump —
/// новые значения из `https://dist.ipfs.tech/kubo/<ver>/<file>.sha512` (те же
/// лежат рядом с архивами в релизе ipfs/kubo на GitHub). Тот же файл читает
/// release.yml, когда кладёт архивы в зеркало.
const KUBO_JSON: &str = include_str!("kubo.json");

const DIST_BASE: &str = "https://dist.ipfs.tech/kubo";
const UPSTREAM_REPO: &str = "ipfs/kubo";
/// Релиз `kubo-<версия>` этого репозитория — зеркало архивов (джоба
/// `kubo-mirror` в release.yml). Пока его нет, GitHub отвечает 404 и архив
/// берётся из релиза ipfs/kubo.
const MIRROR_REPO: &str = "Vakutaghin/bastyon-nextgen";

#[derive(Debug, Deserialize)]
struct KuboPin {
    version: String,
    sha512: BTreeMap<String, String>,
}

fn pin() -> &'static KuboPin {
    static PIN: OnceLock<KuboPin> = OnceLock::new();
    PIN.get_or_init(|| serde_json::from_str(KUBO_JSON).expect("ipfs/kubo.json is valid"))
}

/// Запиненная версия Kubo, с ведущим `v`.
pub fn kubo_version() -> &'static str {
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
    /// Пользователь отменил установку (ipfs_cancel_install).
    #[error("installation cancelled")]
    Cancelled,
}

/// Отмена установки: `true` в канале = остановиться. Канал общий на менеджер,
/// каждый ensure сбрасывает его в `false` перед стартом.
pub type CancelRx = watch::Receiver<bool>;

/// Проверка между фазами установки (распаковка, init и т.д. не прерываются
/// посередине — они короткие; прерывается только скачивание, см. copy_stream).
pub fn check_cancelled(cancel: &CancelRx) -> Result<(), InstallError> {
    if *cancel.borrow() {
        Err(InstallError::Cancelled)
    } else {
        Ok(())
    }
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
    let archive_name = format!("kubo_{}_{go_os}-{go_arch}.{ext}", kubo_version());
    Ok(PlatformInfo {
        archive_name,
        is_zip,
    })
}

/// Запиненный SHA-512 для имени архива (None — если такого артефакта нет в таблице).
pub fn expected_sha512(archive_name: &str) -> Option<&'static str> {
    pin().sha512.get(archive_name).map(String::as_str)
}

/// Откуда качать архив, по порядку. dist.ipfs.tech бывает недоступен целиком
/// (19.10.2026 не отвечал ни из Грузии, ни из Германии), а те же архивы лежат в
/// релизе на GitHub. Первым — зеркало этого репозитория, как у Tor. Подлинность
/// держит запиненный хэш, а не источник.
fn archive_urls(version: &str, archive_name: &str) -> Vec<String> {
    vec![
        format!("https://github.com/{MIRROR_REPO}/releases/download/kubo-{version}/{archive_name}"),
        format!("https://github.com/{UPSTREAM_REPO}/releases/download/{version}/{archive_name}"),
        format!("{DIST_BASE}/{version}/{archive_name}"),
    ]
}

/// Перенести модуль, скачанный раньше в папку кэшей (`<cache>/ipfs`), к данным
/// приложения — без повторного скачивания. Кэш чистят система и программы
/// очистки, и модуль оттуда пропадал. Не вышло перенести — скачается снова.
pub fn adopt_legacy_install(legacy: &Path, paths: &IpfsPaths) {
    if legacy == paths.bin_dir.as_path() {
        return;
    }
    let Some(bin_name) = paths.binary.file_name() else {
        return;
    };
    let old_binary = legacy.join("kubo").join(bin_name);
    let old_marker = legacy.join("install.json");
    let drop_legacy = || {
        let _ = fs::remove_dir_all(legacy.join("kubo"));
        let _ = fs::remove_file(&old_marker);
    };
    if paths.binary.is_file() && paths.install_marker.is_file() {
        // Уже на новом месте — оставшаяся в кэше копия только занимает место.
        if old_binary.exists() {
            drop_legacy();
        }
        return;
    }
    if !old_binary.is_file() || !old_marker.is_file() {
        return;
    }
    let moved = (|| -> std::io::Result<()> {
        if let Some(dir) = paths.binary.parent() {
            fs::create_dir_all(dir)?;
        }
        move_file(&old_binary, &paths.binary)?;
        // Маркер — последним: без него бинарь готовым не считается.
        move_file(&old_marker, &paths.install_marker)
    })();
    match moved {
        Ok(()) => {
            drop_legacy();
            log::info!("[ipfs] Kubo moved out of the cache folder");
        }
        Err(e) => log::warn!("[ipfs] could not move Kubo out of the cache folder: {e}"),
    }
}

/// rename, а между дисками — копия (с правами) и удаление.
fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
    if fs::rename(from, to).is_ok() {
        return Ok(());
    }
    fs::copy(from, to)?;
    fs::remove_file(from)
}

/// Версия установленного бинаря из install.json (None — маркера нет).
pub fn installed_version(paths: &IpfsPaths) -> Option<String> {
    let raw = fs::read_to_string(&paths.install_marker).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("version")?.as_str().map(|s| s.to_string())
}

/// Установлен Kubo прошлой закреплённой версии: новый скачивается в фоне
/// (`stage_update`) и встаёт при следующем запуске ноды (`apply_staged`).
pub fn update_available(paths: &IpfsPaths) -> bool {
    paths.binary.is_file() && installed_version(paths).as_deref() != Some(kubo_version())
}

/// Архив закреплённой версии рядом с бинарём: скачан в фоне, ждёт запуска ноды.
fn staged_archive(paths: &IpfsPaths) -> Result<std::path::PathBuf, InstallError> {
    Ok(paths.bin_dir.join(detect_platform()?.archive_name))
}

pub fn update_staged(paths: &IpfsPaths) -> bool {
    staged_archive(paths).is_ok_and(|p| p.is_file())
}

/// Архивы и недокачанное прежних версий: приложение обновилось дважды, а нода
/// так и не запускалась.
pub fn remove_stale_archives(paths: &IpfsPaths) {
    let Ok(current) = detect_platform().map(|p| p.archive_name) else {
        return;
    };
    let Ok(entries) = fs::read_dir(&paths.bin_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("kubo_") && name != current && entry.path().is_file() {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// Пауза без единого байта, после которой фоновое скачивание считается оборванным.
const STALL_TIMEOUT: Duration = Duration::from_secs(60);

/// Скачать архив закреплённой версии, не трогая установленный бинарь: нода
/// работает дальше. `client` — `crate::fetch::download_client`, под Tor —
/// через Tor.
pub async fn stage_update(client: &reqwest::Client, paths: &IpfsPaths) -> Result<(), InstallError> {
    let platform = detect_platform()?;
    let expected = expected_sha512(&platform.archive_name)
        .ok_or_else(|| InstallError::HashMissing(platform.archive_name.clone()))?;
    let dest = paths.bin_dir.join(&platform.archive_name);
    if dest.is_file() {
        return Ok(());
    }
    let part = paths.bin_dir.join(format!("{}.part", platform.archive_name));
    let mut last_err: Option<InstallError> = None;
    for url in archive_urls(kubo_version(), &platform.archive_name) {
        let result = match fetch_to(client, &url, &part).await {
            Ok(()) => verify_sha512(&part, &platform.archive_name, expected),
            Err(e) => Err(e),
        };
        match result {
            Ok(()) => {
                fs::rename(&part, &dest)?;
                return Ok(());
            }
            Err(e) => {
                log::warn!("[ipfs] update from {} failed: {}", url, e);
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
        let next = tokio::time::timeout(STALL_TIMEOUT, stream.next())
            .await
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "download stalled"))?;
        let Some(chunk) = next else { break };
        file.write_all(&chunk?)?;
    }
    file.flush()?;
    Ok(())
}

/// Поставить архив, скачанный в фоне. Только пока нода не запущена: бинарь
/// работающего демона не заменить. Хэш сверяется ещё раз — архив пролежал на
/// диске.
pub fn apply_staged(paths: &IpfsPaths) -> Result<bool, InstallError> {
    let platform = detect_platform()?;
    let archive = paths.bin_dir.join(&platform.archive_name);
    if !archive.is_file() {
        return Ok(false);
    }
    let expected = expected_sha512(&platform.archive_name)
        .ok_or_else(|| InstallError::HashMissing(platform.archive_name.clone()))?;
    verify_sha512(&archive, &platform.archive_name, expected)?;
    replace_binary(paths, &archive, platform.is_zip)?;
    write_install_marker(paths, &platform.archive_name);
    let _ = fs::remove_file(&archive);
    Ok(true)
}

/// Распаковать в отдельный каталог и заменить бинарь одним переименованием:
/// сбой посередине прежний бинарь не портит.
fn replace_binary(paths: &IpfsPaths, archive: &Path, is_zip: bool) -> Result<(), InstallError> {
    let next = paths.bin_dir.join("next");
    let _ = fs::remove_dir_all(&next);
    fs::create_dir_all(&next)?;
    let result = (|| {
        if is_zip {
            extract_zip(archive, &next)?;
        } else {
            extract_tar_gz(archive, &next)?;
        }
        let rel = paths
            .binary
            .strip_prefix(&paths.bin_dir)
            .map_err(|_| InstallError::ExtractedFileMissing(paths.binary.to_string_lossy().to_string()))?;
        let fresh = next.join(rel);
        if !fresh.is_file() {
            return Err(InstallError::ExtractedFileMissing(
                fresh.to_string_lossy().to_string(),
            ));
        }
        prepare_binary(&fresh, &next)?;
        fs::rename(&fresh, &paths.binary)?;
        Ok(())
    })();
    let _ = fs::remove_dir_all(&next);
    result
}

/// Верхний уровень: гарантировать наличие бинаря kubo. No-op, если уже
/// установлен. «Установлен» = бинарь И маркер: маркер пишется последним, так что
/// усечённый бинарь после краша посреди распаковки (маркера нет) переставится,
/// а не считался бы готовым («Exec format error» при spawn). Отмена прерывает
/// скачивание и удаляет недокачанный архив.
pub async fn ensure_installed<R: Runtime>(
    app: &AppHandle<R>,
    paths: &IpfsPaths,
    cancel: &CancelRx,
) -> Result<(), InstallError> {
    if paths.binary.is_file() && paths.install_marker.is_file() {
        // Нода не запущена — самое время поставить версию, скачанную в фоне.
        // Не вышло — запустится прежняя.
        if update_available(paths) {
            match apply_staged(paths) {
                Ok(true) => log::info!("[ipfs] Kubo {} installed", kubo_version()),
                Ok(false) => {}
                Err(e) => log::warn!("[ipfs] staged update: {}", e),
            }
        }
        return Ok(());
    }

    fs::create_dir_all(&paths.bin_dir)?;

    let platform = detect_platform()?;
    let expected = expected_sha512(&platform.archive_name)
        .ok_or_else(|| InstallError::HashMissing(platform.archive_name.clone()))?;

    let archive_path = paths.bin_dir.join(&platform.archive_name);

    // Источники по очереди: недоступен, 404 или хэш не тот — следующий.
    let mut last_err: Option<InstallError> = None;
    let mut verified = false;
    for url in archive_urls(kubo_version(), &platform.archive_name) {
        emit_progress(
            app,
            "starting",
            0.0,
            &format!("Downloading {}", platform.archive_name),
        );
        match download_with_progress(app, &url, &archive_path, cancel).await {
            Ok(()) => {}
            Err(InstallError::Cancelled) => {
                let _ = fs::remove_file(&archive_path);
                return Err(InstallError::Cancelled);
            }
            Err(e) => {
                log::warn!("[ipfs] download from {} failed: {}", url, e);
                let _ = fs::remove_file(&archive_path);
                last_err = Some(e);
                continue;
            }
        }
        if let Err(e) = check_cancelled(cancel) {
            let _ = fs::remove_file(&archive_path);
            return Err(e);
        }

        emit_progress(app, "verifying", 0.95, "Verifying SHA-512");
        match verify_sha512(&archive_path, &platform.archive_name, expected) {
            Ok(()) => {
                verified = true;
                break;
            }
            Err(e) => {
                log::warn!("[ipfs] archive from {} rejected: {}", url, e);
                last_err = Some(e);
            }
        }
    }
    if !verified {
        return Err(last_err.unwrap_or(InstallError::ExtractedFileMissing(
            platform.archive_name.clone(),
        )));
    }

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
    prepare_binary(&paths.binary, &paths.bin_dir)?;

    write_install_marker(paths, &platform.archive_name);
    emit_progress(app, "ready", 1.0, "Kubo installed");
    Ok(())
}

/// Сделать распакованный бинарь запускаемым.
fn prepare_binary(binary: &Path, dir: &Path) -> Result<(), InstallError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = fs::metadata(binary)?.permissions();
        p.set_mode(0o755);
        fs::set_permissions(binary, p)?;
    }

    #[cfg(target_os = "macos")]
    {
        // Apple Silicon убивает скачанный неподписанный arm64-бинарь (`Killed: 9`)
        // при exec. Ad-hoc-переподпись снимает это. Best-effort: инструментов
        // может не быть, тогда полагаемся на снятие quarantine ниже.
        let _ = std::process::Command::new("codesign")
            .args(["-s", "-", "-f"])
            .arg(binary)
            .output();
        let _ = std::process::Command::new("xattr")
            .arg("-dr")
            .arg("com.apple.quarantine")
            .arg(dir)
            .output();
    }
    #[cfg(not(target_os = "macos"))]
    let _ = dir;
    Ok(())
}

async fn download_with_progress<R: Runtime>(
    app: &AppHandle<R>,
    url: &str,
    dest: &Path,
    cancel: &CancelRx,
) -> Result<(), InstallError> {
    // Без общего лимита на всё скачивание: архив 40–55 МБ на медленном канале
    // идёт дольше десяти минут, и такой лимит не давал бы поставить Kubo вовсе.
    // Недоступный источник отваливается на соединении, замолчавший — на чтении,
    // и очередь переходит к следующему.
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(Duration::from_secs(60))
        .build()?;
    // Отмена и во время соединения, а не только между кусками.
    let mut cancel_wait = cancel.clone();
    // `Ok(_)`: закрытый канал (отправителя нет) — не отмена, ветка просто гаснет.
    let resp = tokio::select! {
        biased;
        Ok(_) = cancel_wait.wait_for(|c| *c) => return Err(InstallError::Cancelled),
        r = client.get(url).send() => r?.error_for_status()?,
    };
    let total = resp.content_length().unwrap_or(0);

    let mut file = fs::File::create(dest)?;
    let mut last_emit: f32 = -1.0;
    copy_stream(resp.bytes_stream(), &mut file, cancel, |downloaded| {
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
    })
    .await?;
    Ok(())
}

/// Копирует поток в writer, пока не кончится или не придёт отмена. Отмена
/// срабатывает сразу, даже если сервер замолчал и следующего куска нет.
async fn copy_stream<S, B, E, W>(
    mut stream: S,
    out: &mut W,
    cancel: &CancelRx,
    mut on_progress: impl FnMut(u64),
) -> Result<u64, InstallError>
where
    S: Stream<Item = Result<B, E>> + Unpin,
    B: AsRef<[u8]>,
    E: Into<InstallError>,
    W: Write,
{
    let mut cancel = cancel.clone();
    let mut copied: u64 = 0;
    loop {
        let next = tokio::select! {
            biased;
            Ok(_) = cancel.wait_for(|c| *c) => return Err(InstallError::Cancelled),
            next = stream.next() => next,
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(Into::into)?;
        out.write_all(chunk.as_ref())?;
        copied += chunk.as_ref().len() as u64;
        on_progress(copied);
    }
    Ok(copied)
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
        "version": kubo_version(),
        "archive": archive_name,
    });
    let _ = fs::write(&paths.install_marker, body.to_string());
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, phase: &str, fraction: f32, message: &str) {
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
                let name = format!("kubo_{}_{go_os}-{go_arch}.{ext}", kubo_version());
                assert!(
                    expected_sha512(&name).is_some(),
                    "missing pinned SHA-512 for {name}"
                );
            }
        }
    }

    #[test]
    fn pinned_hashes_are_128_lowercase_hex_chars() {
        for (name, hash) in &pin().sha512 {
            assert_eq!(hash.len(), 128, "{name}: bad length");
            assert!(
                hash.chars().all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c)),
                "{name}: not lowercase hex"
            );
        }
    }

    /// Ключи — архивы той же версии: release.yml качает их по этим именам.
    #[test]
    fn pinned_archives_belong_to_the_pinned_version() {
        let prefix = format!("kubo_{}_", kubo_version());
        assert!(kubo_version().starts_with('v'));
        assert_eq!(pin().sha512.len(), 6);
        for name in pin().sha512.keys() {
            assert!(name.starts_with(&prefix), "{name}");
        }
    }

    #[test]
    fn github_is_tried_before_dist_ipfs_tech() {
        const NAME: &str = "kubo_v0.43.0_linux-amd64.tar.gz";
        assert_eq!(
            archive_urls("v0.43.0", NAME),
            vec![
                format!("https://github.com/Vakutaghin/bastyon-nextgen/releases/download/kubo-v0.43.0/{NAME}"),
                format!("https://github.com/ipfs/kubo/releases/download/v0.43.0/{NAME}"),
                format!("https://dist.ipfs.tech/kubo/v0.43.0/{NAME}"),
            ]
        );
    }

    fn legacy_layout(tag: &str) -> (std::path::PathBuf, IpfsPaths) {
        let root = std::env::temp_dir().join(format!("kubo-legacy-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let legacy = root.join("cache").join("ipfs");
        let paths = IpfsPaths::new(root.join("data/ipfs/bin"), root.join("data/ipfs/repo"));
        let bin_name = paths.binary.file_name().unwrap().to_owned();
        fs::create_dir_all(legacy.join("kubo")).unwrap();
        fs::write(legacy.join("kubo").join(bin_name), b"kubo").unwrap();
        fs::write(legacy.join("install.json"), r#"{"version":"v0.43.0"}"#).unwrap();
        (root, paths)
    }

    /// Модуль из папки кэшей переезжает к данным приложения и не качается снова.
    #[test]
    fn module_in_the_cache_folder_moves_to_app_data() {
        let (root, paths) = legacy_layout("move");
        let legacy = root.join("cache").join("ipfs");

        adopt_legacy_install(&legacy, &paths);

        assert_eq!(fs::read(&paths.binary).unwrap(), b"kubo");
        assert_eq!(installed_version(&paths).as_deref(), Some("v0.43.0"));
        assert!(!legacy.join("kubo").exists());
        assert!(!legacy.join("install.json").exists());
        let _ = fs::remove_dir_all(&root);
    }

    /// Без маркера (распаковку прервали) в кэше — не переносим: скачается заново.
    #[test]
    fn unfinished_install_in_the_cache_folder_is_not_moved() {
        let (root, paths) = legacy_layout("partial");
        let legacy = root.join("cache").join("ipfs");
        fs::remove_file(legacy.join("install.json")).unwrap();

        adopt_legacy_install(&legacy, &paths);

        assert!(!paths.binary.exists());
        let _ = fs::remove_dir_all(&root);
    }

    /// Модуль уже на новом месте — копия в кэше удаляется, новый не трогаем.
    #[test]
    fn leftover_copy_in_the_cache_folder_is_removed() {
        let (root, paths) = legacy_layout("leftover");
        let legacy = root.join("cache").join("ipfs");
        fs::create_dir_all(paths.binary.parent().unwrap()).unwrap();
        fs::write(&paths.binary, b"new").unwrap();
        fs::write(&paths.install_marker, r#"{"version":"v0.43.0"}"#).unwrap();

        adopt_legacy_install(&legacy, &paths);

        assert_eq!(fs::read(&paths.binary).unwrap(), b"new");
        assert!(!legacy.join("kubo").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn reads_installed_version_from_marker() {
        let dir = std::env::temp_dir().join(format!("kubo-marker-test-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let paths = IpfsPaths::new(dir.clone(), dir.join("repo"));
        assert_eq!(installed_version(&paths), None);
        fs::write(&paths.install_marker, r#"{"version":"v0.43.0","archive":"x"}"#).unwrap();
        assert_eq!(installed_version(&paths).as_deref(), Some("v0.43.0"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn copy_stream_copies_everything_without_cancel() {
        let (_tx, rx) = watch::channel(false);
        let chunks = vec![Ok::<_, std::io::Error>(vec![1u8, 2]), Ok(vec![3])];
        let mut out = Vec::new();
        let mut seen = Vec::new();
        let n = copy_stream(futures_util::stream::iter(chunks), &mut out, &rx, |c| seen.push(c))
            .await
            .unwrap();
        assert_eq!(n, 3);
        assert_eq!(out, vec![1, 2, 3]);
        assert_eq!(seen, vec![2, 3]);
    }

    #[tokio::test]
    async fn cancel_interrupts_a_stalled_download() {
        let (tx, rx) = watch::channel(false);
        // Сервер отдал кусок и замолчал: без select отмена ждала бы следующего.
        let stalled = futures_util::stream::iter(vec![Ok::<_, std::io::Error>(vec![7u8])])
            .chain(futures_util::stream::pending());
        let mut out = Vec::new();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let _ = tx.send(true);
        });
        let res = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            copy_stream(stalled, &mut out, &rx, |_| {}),
        )
        .await
        .expect("отмена не прервала зависшее скачивание");
        assert!(matches!(res, Err(InstallError::Cancelled)));
        assert_eq!(out, vec![7]);
    }

    #[tokio::test]
    async fn closed_cancel_channel_is_not_a_cancel() {
        let (tx, rx) = watch::channel(false);
        drop(tx);
        let chunks = vec![Ok::<_, std::io::Error>(vec![1u8]), Ok(vec![2])];
        let mut out = Vec::new();
        let n = copy_stream(futures_util::stream::iter(chunks), &mut out, &rx, |_| {})
            .await
            .unwrap();
        assert_eq!(n, 2);
    }

    #[test]
    fn check_cancelled_follows_the_flag() {
        let (tx, rx) = watch::channel(false);
        assert!(check_cancelled(&rx).is_ok());
        tx.send(true).unwrap();
        assert!(matches!(check_cancelled(&rx), Err(InstallError::Cancelled)));
    }

    /// Живая установка: `BASTYON_IPFS_INSTALL_ROOT=<пустой каталог> cargo test
    /// --lib ipfs::installer::tests::live_install -- --ignored --nocapture`.
    /// Качает ~40 МБ: зеркало, при 404 — релиз ipfs/kubo, потом dist.ipfs.tech.
    #[test]
    #[ignore]
    fn live_install() {
        let root = std::path::PathBuf::from(
            std::env::var("BASTYON_IPFS_INSTALL_ROOT").expect("BASTYON_IPFS_INSTALL_ROOT"),
        );
        let paths = IpfsPaths::new(root.clone(), root.join("repo"));
        let app = tauri::test::mock_builder()
            .build(tauri::generate_context!(test = true))
            .expect("mock app");
        let handle = app.handle().clone();
        let (_tx, rx) = watch::channel(false);
        tauri::async_runtime::block_on(async move {
            ensure_installed(&handle, &paths, &rx).await.expect("install");
            assert!(paths.binary.is_file());
            assert_eq!(installed_version(&paths).as_deref(), Some(kubo_version()));
            let out = std::process::Command::new(&paths.binary)
                .arg("version")
                .output()
                .expect("run kubo");
            let printed = String::from_utf8_lossy(&out.stdout);
            assert!(
                printed.contains(kubo_version().trim_start_matches('v')),
                "{printed}"
            );
        });
    }

    #[test]
    fn a_staged_archive_replaces_the_binary() {
        let root = std::env::temp_dir().join(format!("kubo-staged-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let paths = IpfsPaths::new(root.join("bin"), root.join("repo"));
        fs::create_dir_all(paths.binary.parent().unwrap()).unwrap();
        fs::write(&paths.binary, b"old").unwrap();
        assert!(!apply_staged(&paths).unwrap(), "скачанного нет");

        // Архив как у Kubo: kubo/ipfs и рядом прочее.
        let rel = paths.binary.strip_prefix(&paths.bin_dir).unwrap().to_path_buf();
        let archive = root.join("kubo.tar.gz");
        {
            let gz = flate2::write::GzEncoder::new(
                fs::File::create(&archive).unwrap(),
                flate2::Compression::fast(),
            );
            let mut tar = tar::Builder::new(gz);
            for (path, body) in [(rel.as_path(), &b"new"[..]), (Path::new("kubo/LICENSE"), &b"MIT"[..])] {
                let mut header = tar::Header::new_gnu();
                header.set_size(body.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                tar.append_data(&mut header, path, body).unwrap();
            }
            tar.into_inner().unwrap().finish().unwrap();
        }
        replace_binary(&paths, &archive, false).unwrap();
        assert_eq!(fs::read(&paths.binary).unwrap(), b"new");
        assert!(!paths.bin_dir.join("next").exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(&paths.binary).unwrap().permissions().mode() & 0o111, 0o111);
        }

        // Битый архив прежний бинарь не трогает.
        fs::write(&archive, b"not a tar.gz").unwrap();
        assert!(replace_binary(&paths, &archive, false).is_err());
        assert_eq!(fs::read(&paths.binary).unwrap(), b"new");
        assert!(!paths.bin_dir.join("next").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn archives_of_other_versions_are_removed() {
        let root = std::env::temp_dir().join(format!("kubo-stale-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let paths = IpfsPaths::new(root.join("bin"), root.join("repo"));
        fs::create_dir_all(&paths.bin_dir).unwrap();
        let current = detect_platform().unwrap().archive_name;
        for name in [current.as_str(), "kubo_v0.40.0_x.tar.gz", "kubo_v0.40.0_x.tar.gz.part", "install.json"] {
            fs::write(paths.bin_dir.join(name), b"x").unwrap();
        }
        assert!(update_staged(&paths));
        remove_stale_archives(&paths);
        assert!(paths.bin_dir.join(&current).exists());
        assert!(paths.bin_dir.join("install.json").exists());
        assert!(!paths.bin_dir.join("kubo_v0.40.0_x.tar.gz").exists());
        assert!(!paths.bin_dir.join("kubo_v0.40.0_x.tar.gz.part").exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn update_available_compares_to_pinned_version() {
        let dir = std::env::temp_dir().join(format!("kubo-upd-test-{}", std::process::id()));
        let paths = IpfsPaths::new(dir.clone(), dir.join("repo"));
        // Нет бинаря → нечего обновлять.
        let _ = fs::create_dir_all(paths.binary.parent().unwrap());
        assert!(!update_available(&paths));
        fs::write(&paths.binary, b"x").unwrap();
        // Совпадает с запиненной → нет обновления.
        fs::write(&paths.install_marker, format!(r#"{{"version":"{}"}}"#, kubo_version())).unwrap();
        assert!(!update_available(&paths));
        // Старая версия → есть обновление.
        fs::write(&paths.install_marker, r#"{"version":"v0.0.1"}"#).unwrap();
        assert!(update_available(&paths));
        let _ = fs::remove_dir_all(&dir);
    }
}
