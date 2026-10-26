//! Модуль сжатия видео: FFmpeg и ffprobe, которые приложение скачивает, когда
//! человек сам об этом попросит, — видео грузят не все, а сборка весит
//! 36–56 МБ. Если FFmpeg с x264 уже есть в системе, модуль не нужен.
//!
//! Статические сборки из релиза eugeneware/ffmpeg-static: x264 и AAC на
//! выходе, все распространённые форматы на входе. Размер и SHA-256 каждого
//! файла закреплены в `ffmpeg.json` — скачивание и запуск бинаря это канал
//! исполнения чужого кода, и подменённый файл не пройдёт, откуда бы ни пришёл.
//! Сначала — зеркало в релизе этого репозитория (джоба `ffmpeg-mirror` в
//! release.yml), потом исходный релиз. Под Tor — только через Tor.
//!
//! Событие для интерфейса: `ffmpeg:install-progress` { received, total }.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;

use crate::fetch::{download_client, fetch_pinned, FetchError, Pinned};
use crate::tor::TorManager;

/// Закреплённая сборка: версия релиза и файлы `<инструмент>-<платформа>.gz`
/// с размером и SHA-256 (те же, что GitHub показывает у файлов релиза). Тот
/// же файл читает release.yml, когда кладёт файлы в зеркало.
const PIN_JSON: &str = include_str!("ffmpeg.json");

const UPSTREAM_REPO: &str = "eugeneware/ffmpeg-static";
/// Релиз `ffmpeg-<версия>` этого репозитория — зеркало (джоба `ffmpeg-mirror`).
/// Пока его нет, GitHub отвечает 404 и файл берётся из исходного релиза.
const MIRROR_REPO: &str = "Vakutaghin/bastyon-nextgen";

/// Инструменты модуля: ffprobe читает параметры видео, ffmpeg сжимает.
pub const TOOLS: [&str; 2] = ["ffmpeg", "ffprobe"];

#[derive(Debug, Deserialize)]
struct PinnedFile {
    sha256: String,
    size: u64,
}

#[derive(Debug, Deserialize)]
struct FfmpegPin {
    version: String,
    files: BTreeMap<String, PinnedFile>,
}

fn pin() -> &'static FfmpegPin {
    static PIN: OnceLock<FfmpegPin> = OnceLock::new();
    PIN.get_or_init(|| serde_json::from_str(PIN_JSON).expect("ffmpeg/ffmpeg.json is valid"))
}

/// Платформа в именах файлов eugeneware/ffmpeg-static.
pub fn platform_suffix(os: &str, arch: &str) -> Option<&'static str> {
    match (os, arch) {
        ("macos", "aarch64") => Some("darwin-arm64"),
        ("macos", "x86_64") => Some("darwin-x64"),
        ("linux", "x86_64") => Some("linux-x64"),
        ("linux", "aarch64") => Some("linux-arm64"),
        ("windows", "x86_64") => Some("win32-x64"),
        _ => None,
    }
}

fn current_suffix() -> Option<&'static str> {
    platform_suffix(std::env::consts::OS, std::env::consts::ARCH)
}

fn archive_name(tool: &str, suffix: &str) -> String {
    format!("{tool}-{suffix}.gz")
}

/// Откуда качать файл, по порядку. Подлинность держит закреплённый хэш, а не
/// источник.
fn archive_urls(version: &str, name: &str) -> Vec<String> {
    vec![
        format!("https://github.com/{MIRROR_REPO}/releases/download/ffmpeg-{version}/{name}"),
        format!("https://github.com/{UPSTREAM_REPO}/releases/download/{version}/{name}"),
    ]
}

/// Сколько скачивать на этой платформе (None — модуля для неё нет).
fn download_size(suffix: &str) -> Option<u64> {
    TOOLS
        .iter()
        .map(|tool| pin().files.get(&archive_name(tool, suffix)).map(|f| f.size))
        .sum()
}

#[derive(Clone)]
pub struct FfmpegPaths {
    dir: PathBuf,
}

impl FfmpegPaths {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn binary(&self, tool: &str) -> PathBuf {
        let name = if cfg!(windows) {
            format!("{tool}.exe")
        } else {
            tool.to_string()
        };
        self.dir.join(name)
    }

    fn marker(&self) -> PathBuf {
        self.dir.join("install.json")
    }

    /// Версия установленного модуля: оба бинаря на месте и маркер. Маркер
    /// пишется последним: бинарь, распакованный наполовину перед падением,
    /// без него готовым не считается.
    pub fn installed_version(&self) -> Option<String> {
        let version = std::fs::read_to_string(self.marker())
            .ok()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|v| v.get("version")?.as_str().map(str::to_string))
            .filter(|v| !v.is_empty())?;
        TOOLS
            .iter()
            .all(|tool| self.binary(tool).is_file())
            .then_some(version)
    }

    /// Версия любая: модуль прошлой версии сжимает, пока новая скачивается
    /// в фоне (`schedule_update`).
    pub fn is_installed(&self) -> bool {
        self.installed_version().is_some()
    }

    /// Установлен модуль прошлой закреплённой сборки.
    fn is_outdated(&self) -> bool {
        self.installed_version()
            .is_some_and(|v| v != pin().version)
    }

    fn write_marker(&self) -> std::io::Result<()> {
        let body = serde_json::json!({ "version": pin().version });
        std::fs::write(self.marker(), body.to_string())
    }

    /// Сюда в фоне скачивается новая сборка — тот же вид, что у модуля.
    fn staged(&self) -> FfmpegPaths {
        FfmpegPaths::new(self.dir.join("update"))
    }

    /// Поставить скачанную в фоне сборку. Только при запуске приложения:
    /// ни ffmpeg, ни ffprobe ещё не работают, а работающий .exe на Windows не
    /// заменить. Недокачанное или сборка уже не той версии — удаляется.
    fn apply_staged(&self) -> std::io::Result<bool> {
        let staged = self.staged();
        if !staged.dir.exists() {
            return Ok(false);
        }
        let ready = staged.installed_version().as_deref() == Some(pin().version.as_str());
        if ready {
            for tool in TOOLS {
                std::fs::rename(staged.binary(tool), self.binary(tool))?;
            }
            self.write_marker()?;
        }
        std::fs::remove_dir_all(&staged.dir)?;
        Ok(ready)
    }

    /// Убрать модуль: сначала маркер — без него остаток не считается модулем.
    fn remove(&self) -> std::io::Result<()> {
        if self.marker().exists() {
            std::fs::remove_file(self.marker())?;
        }
        for tool in TOOLS {
            let path = self.binary(tool);
            if path.exists() {
                std::fs::remove_file(path)?;
            }
        }
        let staged = self.staged();
        if staged.dir.exists() {
            std::fs::remove_dir_all(&staged.dir)?;
        }
        Ok(())
    }
}

/// Распаковать `<инструмент>.gz` в исполняемый файл. Пишется во временный
/// файл рядом и переименовывается: недописанный бинарь не займёт место
/// настоящего.
fn unpack(gz: &Path, dest: &Path) -> std::io::Result<()> {
    let part = dest.with_extension("unpack");
    let result = (|| {
        let mut decoder = flate2::read::GzDecoder::new(std::fs::File::open(gz)?);
        let mut out = std::fs::File::create(&part)?;
        let mut buf = vec![0u8; 1 << 20];
        loop {
            let n = decoder.read(&mut buf)?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n])?;
        }
        out.flush()?;
        drop(out);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&part, std::fs::Permissions::from_mode(0o755))?;
        }
        std::fs::rename(&part, dest)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&part);
    }
    result?;
    #[cfg(target_os = "macos")]
    {
        // Как у Kubo: Apple Silicon не запускает arm64-бинарь без подписи,
        // ad-hoc-подпись это снимает. Best-effort.
        let _ = std::process::Command::new("codesign")
            .args(["-s", "-", "-f"])
            .arg(dest)
            .output();
    }
    Ok(())
}

static MODULE_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Бинарь модуля, если модуль установлен, — его `tool_command` в lib.rs
/// берёт раньше системного.
pub fn module_binary(tool: &str) -> Option<PathBuf> {
    let paths = FfmpegPaths::new(MODULE_DIR.get()?.clone());
    paths.is_installed().then(|| paths.binary(tool))
}

pub struct FfmpegManager {
    paths: FfmpegPaths,
    install_cancel: Mutex<Option<watch::Sender<bool>>>,
    /// Фоновое скачивание новой сборки: интерфейс его не показывает.
    update_cancel: Mutex<Option<watch::Sender<bool>>>,
}

impl FfmpegManager {
    /// Каталог модуля — для места на диске (crate::storage).
    pub fn dir(&self) -> &Path {
        &self.paths.dir
    }

    /// Версия для вкладки «Модули»: установленная и закреплённая.
    pub fn version(&self) -> Option<crate::storage::ModuleVersion> {
        let installed = self.paths.installed_version()?;
        Some(crate::storage::ModuleVersion::new(
            installed.trim_start_matches('b'),
            pin().version.trim_start_matches('b'),
            installed != pin().version,
        ))
    }
}

/// Когда пробовать скачать новую сборку после запуска: сразу после запуска
/// сеть и Tor заняты своим.
const UPDATE_DELAYS: [Duration; 2] = [Duration::from_secs(90), Duration::from_secs(15 * 60)];

/// Модуль прошлой закреплённой сборки — докачать новую в фоне: человек уже
/// согласился на модуль, когда скачал его. Встанет при следующем запуске
/// приложения (`apply_staged`), а до того сжимает прежний.
fn schedule_update(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Some(suffix) = current_suffix() else {
            return;
        };
        for delay in UPDATE_DELAYS {
            tokio::time::sleep(delay).await;
            let mgr = app.state::<FfmpegManager>();
            let staged = mgr.paths.staged();
            if !mgr.paths.is_outdated()
                || staged.installed_version().as_deref() == Some(pin().version.as_str())
            {
                return;
            }
            let (cancel_tx, mut cancel_rx) = watch::channel(false);
            *mgr.update_cancel.lock().unwrap_or_else(|p| p.into_inner()) = Some(cancel_tx);
            let tor = app.state::<TorManager>();
            let result = match download_client(&tor).await {
                Ok(client) => install(&client, &staged, suffix, &mut cancel_rx, |_, _| {}).await,
                Err(e) => Err(e),
            };
            *mgr.update_cancel.lock().unwrap_or_else(|p| p.into_inner()) = None;
            match result {
                Ok(()) => {
                    log::info!("[ffmpeg] module {} downloaded", pin().version);
                    return;
                }
                Err(e) => log::warn!("[ffmpeg] module update: {e}"),
            }
        }
    });
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?
        .join("ffmpeg");
    std::fs::create_dir_all(&dir)?;
    // Недокачанное и недораспакованное с прошлого запуска.
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let ext = entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().to_string());
            if matches!(ext.as_deref(), Some("part" | "gz" | "unpack")) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    let paths = FfmpegPaths::new(dir.clone());
    match paths.apply_staged() {
        Ok(true) => log::info!("[ffmpeg] module {} installed", pin().version),
        Ok(false) => {}
        Err(e) => log::warn!("[ffmpeg] staged update: {e}"),
    }
    let _ = MODULE_DIR.set(dir);
    app.manage(FfmpegManager {
        paths,
        install_cancel: Mutex::new(None),
        update_cancel: Mutex::new(None),
    });
    schedule_update(app.clone());
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegModuleStatus {
    /// Для этой платформы модуль есть.
    supported: bool,
    installed: bool,
    installing: bool,
    /// Сколько скачивать, байт.
    size: u64,
    version: &'static str,
}

#[tauri::command]
pub fn ffmpeg_module_status(mgr: State<'_, FfmpegManager>) -> FfmpegModuleStatus {
    let size = current_suffix().and_then(download_size);
    FfmpegModuleStatus {
        supported: size.is_some(),
        installed: mgr.paths.is_installed(),
        installing: mgr
            .install_cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .is_some(),
        size: size.unwrap_or(0),
        version: pin().version.as_str(),
    }
}

#[derive(Clone, Serialize)]
struct InstallProgress {
    received: u64,
    total: u64,
}

/// Скачать один файл: зеркало, потом исходный релиз.
async fn fetch_one(
    client: &reqwest::Client,
    name: &str,
    dest: &Path,
    cancel: &mut watch::Receiver<bool>,
    mut on_progress: impl FnMut(u64),
) -> Result<(), String> {
    let file = pin()
        .files
        .get(name)
        .ok_or_else(|| format!("not_pinned: {name}"))?;
    let pinned = Pinned {
        name,
        sha256: &file.sha256,
        size: file.size,
    };
    let mut last_err = String::from("download_failed");
    for url in archive_urls(&pin().version, name) {
        match fetch_pinned(client, &url, &pinned, dest, cancel, |received, _| {
            on_progress(received)
        })
        .await
        {
            Ok(()) => return Ok(()),
            Err(FetchError::Cancelled) => return Err(FetchError::Cancelled.to_string()),
            Err(e) => {
                log::warn!("[ffmpeg] {url}: {e}");
                last_err = e.to_string();
            }
        }
    }
    Err(last_err)
}

/// Скачать оба инструмента, распаковать и записать маркер. `on_progress`
/// получает (скачано, всего) по обоим файлам вместе.
async fn install(
    client: &reqwest::Client,
    paths: &FfmpegPaths,
    suffix: &str,
    cancel: &mut watch::Receiver<bool>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    let total = download_size(suffix).ok_or_else(|| "unsupported_platform".to_string())?;
    std::fs::create_dir_all(&paths.dir).map_err(|e| format!("install_failed: {e}"))?;
    let mut done: u64 = 0;
    for tool in TOOLS {
        let name = archive_name(tool, suffix);
        let gz = paths.dir.join(&name);
        fetch_one(client, &name, &gz, cancel, |received| {
            on_progress(done + received, total)
        })
        .await?;
        let dest = paths.binary(tool);
        let unpacked = tokio::task::spawn_blocking(move || {
            let result = unpack(&gz, &dest);
            let _ = std::fs::remove_file(&gz);
            result
        })
        .await
        .map_err(|e| format!("install_failed: {e}"))?;
        unpacked.map_err(|e| format!("install_failed: {e}"))?;
        done += pin().files[&name].size;
    }
    paths
        .write_marker()
        .map_err(|e| format!("install_failed: {e}"))?;
    on_progress(total, total);
    Ok(())
}

/// Скачать и поставить модуль.
#[tauri::command]
pub async fn ffmpeg_module_install(
    app: AppHandle,
    mgr: State<'_, FfmpegManager>,
    tor: State<'_, TorManager>,
) -> Result<(), String> {
    let suffix = current_suffix().ok_or_else(|| "unsupported_platform".to_string())?;
    if mgr.paths.is_installed() {
        return Ok(());
    }
    let (cancel_tx, mut cancel_rx) = watch::channel(false);
    {
        let mut slot = mgr.install_cancel.lock().unwrap_or_else(|p| p.into_inner());
        if slot.is_some() {
            return Err("busy".into());
        }
        *slot = Some(cancel_tx);
    }

    let result = async {
        let client = download_client(&tor).await?;
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        install(
            &client,
            &mgr.paths,
            suffix,
            &mut cancel_rx,
            |received, total| {
                if received == total || last_emit.elapsed() >= Duration::from_millis(100) {
                    last_emit = Instant::now();
                    let _ = app.emit(
                        "ffmpeg:install-progress",
                        InstallProgress { received, total },
                    );
                }
            },
        )
        .await
    }
    .await;

    *mgr.install_cancel.lock().unwrap_or_else(|p| p.into_inner()) = None;
    result
}

#[tauri::command]
pub fn ffmpeg_module_cancel_install(mgr: State<'_, FfmpegManager>) {
    if let Some(tx) = mgr
        .install_cancel
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .as_ref()
    {
        let _ = tx.send(true);
    }
}

/// Удалить модуль: сжатие снова будет через системный FFmpeg, если он есть.
#[tauri::command]
pub fn ffmpeg_module_remove(mgr: State<'_, FfmpegManager>) -> Result<(), String> {
    if mgr
        .install_cancel
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .is_some()
    {
        return Err("busy".into());
    }
    // Фоновое обновление пишет в каталог модуля: остановить и попросить
    // повторить — файл, открытый на запись, на Windows не удалить.
    if let Some(tx) = mgr
        .update_cancel
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .as_ref()
    {
        let _ = tx.send(true);
        return Err("busy".into());
    }
    mgr.paths
        .remove()
        .map_err(|e| format!("remove_failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn every_shipped_platform_has_both_tools_pinned() {
        // Платформы, под которые собирается приложение (release.yml), и Linux на ARM.
        for (os, arch) in [
            ("macos", "aarch64"),
            ("macos", "x86_64"),
            ("linux", "x86_64"),
            ("linux", "aarch64"),
            ("windows", "x86_64"),
        ] {
            let suffix = platform_suffix(os, arch).unwrap();
            assert!(download_size(suffix).unwrap() > 30_000_000, "{os}-{arch}");
        }
        assert_eq!(platform_suffix("windows", "aarch64"), None);
        assert_eq!(platform_suffix("freebsd", "x86_64"), None);
    }

    #[test]
    fn pins_are_sha256_of_files_of_this_release() {
        assert!(pin().version.starts_with('b'));
        assert_eq!(pin().files.len(), 10);
        for (name, file) in &pin().files {
            assert!(name.ends_with(".gz"), "{name}");
            assert!(
                TOOLS
                    .iter()
                    .any(|tool| name.starts_with(&format!("{tool}-"))),
                "{name}"
            );
            assert_eq!(file.sha256.len(), 64, "{name}");
            assert!(file
                .sha256
                .chars()
                .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c)));
            assert!(file.size > 0);
        }
    }

    #[test]
    fn the_mirror_is_tried_first() {
        assert_eq!(
            archive_urls("b6.1.1", "ffmpeg-linux-x64.gz"),
            vec![
                "https://github.com/Vakutaghin/bastyon-nextgen/releases/download/ffmpeg-b6.1.1/ffmpeg-linux-x64.gz",
                "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz",
            ]
        );
    }

    #[test]
    fn installed_needs_both_tools_and_the_marker() {
        let dir = std::env::temp_dir().join(format!("ffmpeg-module-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let paths = FfmpegPaths::new(dir.clone());

        // Распаковка: из .gz — исполняемый файл, сам .gz не трогаем.
        for tool in TOOLS {
            let gz = dir.join(format!("{tool}.gz"));
            let mut enc = flate2::write::GzEncoder::new(
                std::fs::File::create(&gz).unwrap(),
                flate2::Compression::fast(),
            );
            enc.write_all(tool.as_bytes()).unwrap();
            enc.finish().unwrap();
            unpack(&gz, &paths.binary(tool)).unwrap();
            assert_eq!(std::fs::read(paths.binary(tool)).unwrap(), tool.as_bytes());
        }
        assert!(!paths.is_installed(), "без маркера модуль не готов");

        paths.write_marker().unwrap();
        assert!(paths.is_installed());

        std::fs::write(paths.marker(), r#"{"version":"b0.0.1"}"#).unwrap();
        assert!(paths.is_installed(), "модуль прошлой версии тоже сжимает");

        std::fs::write(paths.marker(), "{").unwrap();
        assert!(!paths.is_installed(), "битый маркер");

        paths.write_marker().unwrap();
        std::fs::remove_file(paths.binary("ffprobe")).unwrap();
        assert!(!paths.is_installed(), "нет ffprobe");

        paths.remove().unwrap();
        assert!(!paths.marker().exists());
        assert!(!paths.binary("ffmpeg").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_staged_build_replaces_the_old_one_at_start() {
        let dir = std::env::temp_dir().join(format!("ffmpeg-staged-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let paths = FfmpegPaths::new(dir.clone());
        for tool in TOOLS {
            std::fs::write(paths.binary(tool), b"old").unwrap();
        }
        std::fs::write(paths.marker(), r#"{"version":"b0.0.1"}"#).unwrap();
        assert!(paths.is_outdated());
        assert!(!paths.apply_staged().unwrap(), "скачанного нет");

        // Недокачанное (нет маркера) удаляется, прежний модуль остаётся.
        let staged = paths.staged();
        std::fs::create_dir_all(&staged.dir).unwrap();
        std::fs::write(staged.binary("ffmpeg"), b"half").unwrap();
        assert!(!paths.apply_staged().unwrap());
        assert!(!staged.dir.exists());
        assert_eq!(std::fs::read(paths.binary("ffmpeg")).unwrap(), b"old");

        // Скачанная сборка не той версии (приложение обновилось ещё раз) — тоже.
        std::fs::create_dir_all(&staged.dir).unwrap();
        for tool in TOOLS {
            std::fs::write(staged.binary(tool), b"new").unwrap();
        }
        std::fs::write(staged.marker(), r#"{"version":"b0.0.2"}"#).unwrap();
        assert!(!paths.apply_staged().unwrap());
        assert!(!staged.dir.exists());

        std::fs::create_dir_all(&staged.dir).unwrap();
        for tool in TOOLS {
            std::fs::write(staged.binary(tool), b"new").unwrap();
        }
        staged.write_marker().unwrap();
        assert!(paths.apply_staged().unwrap());
        for tool in TOOLS {
            assert_eq!(std::fs::read(paths.binary(tool)).unwrap(), b"new");
        }
        assert!(!paths.is_outdated());
        assert!(!staged.dir.exists());

        std::fs::create_dir_all(&staged.dir).unwrap();
        paths.remove().unwrap();
        assert!(!staged.dir.exists(), "удаление модуля убирает и скачанное");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn unpacked_tool_is_executable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("ffmpeg-exec-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let gz = dir.join("tool.gz");
        let mut enc = flate2::write::GzEncoder::new(
            std::fs::File::create(&gz).unwrap(),
            flate2::Compression::fast(),
        );
        enc.write_all(b"#!/bin/sh\necho ok\n").unwrap();
        enc.finish().unwrap();
        let dest = dir.join("tool");
        unpack(&gz, &dest).unwrap();
        let mode = std::fs::metadata(&dest).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Живая установка: `BASTYON_FFMPEG_INSTALL_ROOT=<пустой каталог> cargo test
    /// --lib ffmpeg::tests::live_install -- --ignored --nocapture`. Качает
    /// 36–56 МБ: зеркало, при 404 — исходный релиз.
    #[test]
    #[ignore]
    fn live_install() {
        let root = PathBuf::from(
            std::env::var("BASTYON_FFMPEG_INSTALL_ROOT").expect("BASTYON_FFMPEG_INSTALL_ROOT"),
        );
        let paths = FfmpegPaths::new(root);
        let suffix = current_suffix().expect("supported platform");
        let (_tx, mut rx) = watch::channel(false);
        tauri::async_runtime::block_on(async {
            let client = reqwest::Client::new();
            let mut last = 0;
            install(&client, &paths, suffix, &mut rx, |received, total| {
                assert!(received >= last && received <= total);
                last = received;
            })
            .await
            .expect("install");
        });
        assert!(paths.is_installed());
        let out = std::process::Command::new(paths.binary("ffmpeg"))
            .args(["-hide_banner", "-encoders"])
            .output()
            .expect("run ffmpeg");
        assert!(String::from_utf8_lossy(&out.stdout).contains(" libx264 "));
        let probe = std::process::Command::new(paths.binary("ffprobe"))
            .arg("-version")
            .output()
            .expect("run ffprobe");
        assert!(probe.status.success());
    }

    #[test]
    fn broken_gz_leaves_nothing_behind() {
        let dir = std::env::temp_dir().join(format!("ffmpeg-broken-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let gz = dir.join("tool.gz");
        std::fs::write(&gz, b"not a gzip").unwrap();
        let dest = dir.join("tool");
        assert!(unpack(&gz, &dest).is_err());
        assert!(!dest.exists());
        assert!(!dest.with_extension("unpack").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
