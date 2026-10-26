//! Место на диске: веб-кэш, кэш IPFS и скачанные модули (настройки →
//! «Система» и «Модули»).
//!
//! Предела веб-кэша в байтах движки не принимают: WebKit (Linux, macOS) знает
//! три режима и сам берёт до 1 ГБ по свободному месту, у WebView2 — свои
//! правила. Поэтому предел держим сами: при запуске, раз в полчаса и при смене
//! предела меряем папку кэша и, если она больше, чистим кэш через движок —
//! только кэш: localStorage и IndexedDB, где аккаунты и настройки, остаются.
//! Предел IPFS — `Datastore.StorageMax` Kubo (ipfs::config), а сверх него —
//! сборка мусора.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const MB: u64 = 1024 * 1024;
const GB: u64 = 1024 * MB;

/// Веб-кэш по умолчанию: WebKit сам брал до 1 ГБ.
pub const DEFAULT_WEB_LIMIT: u64 = 512 * MB;
/// Кэш IPFS по умолчанию — как прежний `StorageMax` «2GB».
pub const DEFAULT_IPFS_LIMIT: u64 = 2 * GB;
/// Меньше кэш бесполезен: картинки ленты качались бы заново на каждом экране.
const MIN_LIMIT: u64 = 50 * MB;
const MAX_LIMIT: u64 = 100 * GB;

const LIMITS_FILE: &str = "storage-limits.json";
/// Первая проверка — когда запуск уже прошёл, чтобы не мешать ему.
const FIRST_CHECK_AFTER: Duration = Duration::from_secs(120);
const CHECK_EVERY: Duration = Duration::from_secs(30 * 60);

/// Предел IPFS для конфига Kubo: читается при каждом запуске ноды.
static IPFS_LIMIT: AtomicU64 = AtomicU64::new(DEFAULT_IPFS_LIMIT);

pub fn ipfs_limit() -> u64 {
    IPFS_LIMIT.load(Ordering::Relaxed)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub web: u64,
    pub ipfs: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            web: DEFAULT_WEB_LIMIT,
            ipfs: DEFAULT_IPFS_LIMIT,
        }
    }
}

impl Limits {
    fn clamped(self) -> Self {
        Self {
            web: self.web.clamp(MIN_LIMIT, MAX_LIMIT),
            ipfs: self.ipfs.clamp(MIN_LIMIT, MAX_LIMIT),
        }
    }
}

pub struct StorageManager {
    limits_file: PathBuf,
    limits: Mutex<Limits>,
    /// Где движок держит дисковый кэш (у WebView2 — несколько папок).
    web_cache: Vec<PathBuf>,
}

impl StorageManager {
    fn limits(&self) -> Limits {
        *self.limits.lock().unwrap_or_else(|p| p.into_inner())
    }
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?;
    std::fs::create_dir_all(&data)?;
    let limits_file = data.join(LIMITS_FILE);
    let limits = read_limits(&limits_file);
    IPFS_LIMIT.store(limits.ipfs, Ordering::Relaxed);
    app.manage(StorageManager {
        limits_file,
        limits: Mutex::new(limits),
        web_cache: web_cache_dirs(app),
    });
    schedule_checks(app.clone());
    Ok(())
}

fn read_limits(file: &Path) -> Limits {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|s| serde_json::from_str::<Limits>(&s).ok())
        .map(Limits::clamped)
        .unwrap_or_default()
}

/// Папки дискового кэша движка. Tauri отдаёт WebKitGTK и WebView2 каталог
/// `LocalData/<identifier>`; WKWebView на macOS кладёт кэш в `Caches/<bundle id>`.
fn web_cache_dirs(app: &AppHandle) -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        app.path()
            .app_cache_dir()
            .map(|dir| vec![dir.join("WebKit")])
            .unwrap_or_default()
    }
    #[cfg(target_os = "linux")]
    {
        app.path()
            .app_local_data_dir()
            .map(|dir| vec![dir.join("WebKitCache")])
            .unwrap_or_default()
    }
    #[cfg(windows)]
    {
        app.path()
            .app_local_data_dir()
            .map(|dir| {
                let profile = dir.join("EBWebView").join("Default");
                vec![profile.join("Cache"), profile.join("Code Cache")]
            })
            .unwrap_or_default()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
    {
        let _ = app;
        Vec::new()
    }
}

/// Размер каталога со всем содержимым; ссылки не раскрываем, недоступное
/// пропускаем.
pub fn dir_size(path: &Path) -> u64 {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return 0;
    };
    if meta.is_file() {
        return meta.len();
    }
    if !meta.is_dir() {
        return 0;
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries.flatten().map(|e| dir_size(&e.path())).sum()
}

fn total_size(dirs: &[PathBuf]) -> u64 {
    dirs.iter().map(|d| dir_size(d)).sum()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModulesUsage {
    ipfs: u64,
    tor: u64,
    voice: u64,
    compression: u64,
    mesh: u64,
}

/// Версия скачанного модуля. Каждая версия приложения закрепляет свою версию
/// модуля вместе с хэшем, и прежний модуль после обновления приложения
/// работает, пока новый не скачается в фоне и не встанет сам.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleVersion {
    /// Пусто — неизвестна (Tor, скачанный до того, как версию стали помечать).
    installed: String,
    /// Закреплённая в этой версии приложения.
    latest: String,
    /// Стоит прежняя: новая скачается и встанет сама.
    pending: bool,
}

impl ModuleVersion {
    pub fn new(installed: &str, latest: &str, pending: bool) -> Self {
        Self {
            installed: installed.to_string(),
            latest: latest.to_string(),
            pending,
        }
    }
}

/// `None` — модуль не скачан. Голосового ввода нет: его движок внутри
/// приложения, а модели — данные без версий.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleVersions {
    ipfs: Option<ModuleVersion>,
    tor: Option<ModuleVersion>,
    compression: Option<ModuleVersion>,
    mesh: Option<ModuleVersion>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    web_cache: u64,
    /// `None` — модуль IPFS не установлен.
    ipfs_cache: Option<u64>,
    limits: Limits,
    modules: ModulesUsage,
    versions: ModuleVersions,
}

/// Что сколько занимает. Обход каталогов — в пуле блокирующих задач: кэш
/// IPFS — тысячи файлов.
#[tauri::command]
pub async fn storage_usage(app: AppHandle) -> Result<StorageUsage, String> {
    let storage = app.state::<StorageManager>();
    let limits = storage.limits();
    let web_dirs = storage.web_cache.clone();
    let ipfs = app.state::<crate::ipfs::IpfsManager>();
    let ipfs_bin = ipfs.paths.bin_dir.clone();
    let ipfs_repo = ipfs.paths.binary.is_file().then(|| ipfs.paths.repo.clone());
    let tor_mgr = app.state::<crate::tor::TorManager>();
    let tor = tor_mgr.paths.root.clone();
    let voice = app.state::<crate::asr::AsrManager>().dir().to_path_buf();
    let ffmpeg = app.state::<crate::ffmpeg::FfmpegManager>();
    let compression = ffmpeg.dir().to_path_buf();
    let mesh_mgr = app.state::<crate::mesh::MeshManager>();
    let mesh = mesh_mgr.disk_dirs();
    let versions = ModuleVersions {
        ipfs: crate::ipfs::module_version(&ipfs),
        tor: crate::tor::module_version(&tor_mgr),
        compression: ffmpeg.version(),
        mesh: mesh_mgr.version(),
    };
    tauri::async_runtime::spawn_blocking(move || StorageUsage {
        web_cache: total_size(&web_dirs),
        ipfs_cache: ipfs_repo.map(|repo| dir_size(&repo)),
        limits,
        modules: ModulesUsage {
            ipfs: dir_size(&ipfs_bin),
            tor: dir_size(&tor),
            voice: dir_size(&voice),
            compression: dir_size(&compression),
            mesh: total_size(&mesh),
        },
        versions,
    })
    .await
    .map_err(|e| e.to_string())
}

/// Новые пределы: сохраняются и сразу проверяются. Кэш IPFS у работающей
/// ноды держит сборка мусора, а в конфиг Kubo предел попадает при её запуске.
#[tauri::command]
pub async fn storage_set_limits(app: AppHandle, limits: Limits) -> Result<Limits, String> {
    let limits = limits.clamped();
    {
        let storage = app.state::<StorageManager>();
        *storage.limits.lock().unwrap_or_else(|p| p.into_inner()) = limits;
        let json = serde_json::to_string(&limits).map_err(|e| e.to_string())?;
        std::fs::write(&storage.limits_file, json).map_err(|e| e.to_string())?;
    }
    IPFS_LIMIT.store(limits.ipfs, Ordering::Relaxed);
    enforce(&app).await;
    Ok(limits)
}

/// «Очистить» в настройках: `web` — кэш движка, `ipfs` — незапиненное в Kubo.
#[tauri::command]
pub async fn storage_clear(app: AppHandle, kind: String) -> Result<(), String> {
    match kind.as_str() {
        "web" => clear_web_cache(&app),
        "ipfs" => {
            let ipfs = app.state::<crate::ipfs::IpfsManager>();
            crate::ipfs::collect_garbage(&ipfs).await
        }
        _ => Err(format!("unknown cache: {kind}")),
    }
}

fn schedule_checks(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_CHECK_AFTER).await;
        loop {
            enforce(&app).await;
            tokio::time::sleep(CHECK_EVERY).await;
        }
    });
}

/// Кэш больше предела — чистим его целиком: движок не умеет удалять самое
/// старое до заданного размера.
async fn enforce(app: &AppHandle) {
    let (limits, web_dirs) = {
        let storage: State<'_, StorageManager> = app.state();
        (storage.limits(), storage.web_cache.clone())
    };
    let web = tauri::async_runtime::spawn_blocking(move || total_size(&web_dirs))
        .await
        .unwrap_or(0);
    if web > limits.web {
        log::info!("[storage] web cache {web} > {}, clearing", limits.web);
        if let Err(e) = clear_web_cache(app) {
            log::warn!("[storage] web cache not cleared: {e}");
        }
    }
    let ipfs = app.state::<crate::ipfs::IpfsManager>();
    if !ipfs.paths.binary.is_file() {
        return;
    }
    let repo = ipfs.paths.repo.clone();
    let size = tauri::async_runtime::spawn_blocking(move || dir_size(&repo))
        .await
        .unwrap_or(0);
    if size > limits.ipfs {
        log::info!("[storage] ipfs cache {size} > {}, collecting garbage", limits.ipfs);
        if let Err(e) = crate::ipfs::collect_garbage(&ipfs).await {
            log::warn!("[storage] ipfs gc: {e}");
        }
    }
}

/// Дисковый кэш и кэш в памяти — через движок главного окна (у остальных окон
/// хранилище то же). Вызов асинхронный: движок удаляет файлы сам.
fn clear_web_cache(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    window
        .with_webview(|webview| {
            if let Err(e) = clear_platform(webview) {
                log::warn!("[storage] web cache: {e}");
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn clear_platform(webview: tauri::webview::PlatformWebview) -> Result<(), String> {
    use webkit2gtk::{
        WebContextExt, WebViewExt, WebsiteDataManagerExtManual, WebsiteDataTypes,
    };
    let manager = webview
        .inner()
        .context()
        .and_then(|context| context.website_data_manager())
        .ok_or_else(|| "no website data manager".to_string())?;
    manager.clear(
        WebsiteDataTypes::DISK_CACHE | WebsiteDataTypes::MEMORY_CACHE,
        webkit2gtk::glib::TimeSpan::from_seconds(0),
        None::<&webkit2gtk::gio::Cancellable>,
        |result| {
            if let Err(e) = result {
                log::warn!("[storage] web cache: {e}");
            }
        },
    );
    Ok(())
}

#[cfg(target_os = "macos")]
fn clear_platform(webview: tauri::webview::PlatformWebview) -> Result<(), String> {
    use objc2_foundation::{NSDate, NSSet};
    use objc2_web_kit::{WKWebView, WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache};
    // SAFETY: Tauri отдаёт живой WKWebView главного окна, вызов — на главном потоке.
    unsafe {
        let view = &*(webview.inner() as *const WKWebView);
        let store = view.configuration().websiteDataStore();
        let types = NSSet::from_slice(&[WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]);
        let since = NSDate::dateWithTimeIntervalSince1970(0.0);
        let done = block2::RcBlock::new(|| {});
        store.removeDataOfTypes_modifiedSince_completionHandler(&types, &since, &done);
    }
    Ok(())
}

#[cfg(windows)]
fn clear_platform(webview: tauri::webview::PlatformWebview) -> Result<(), String> {
    use webview2_com::ClearBrowsingDataCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
    };
    use windows::core::Interface;
    // SAFETY: COM-вызовы WebView2 на главном потоке, где Tauri держит контроллер.
    unsafe {
        webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_13>())
            .and_then(|core| core.Profile())
            .and_then(|profile| profile.cast::<ICoreWebView2Profile2>())
            .and_then(|profile| {
                profile.ClearBrowsingData(
                    COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
                    &ClearBrowsingDataCompletedHandler::create(Box::new(|_| Ok(()))),
                )
            })
            .map_err(|e| e.to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
fn clear_platform(_webview: tauri::webview::PlatformWebview) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bastyon-storage-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn dir_size_sums_nested_files() {
        let dir = temp_dir("size");
        std::fs::write(dir.join("a"), vec![0u8; 1000]).unwrap();
        std::fs::create_dir_all(dir.join("x/y")).unwrap();
        std::fs::write(dir.join("x/y/b"), vec![0u8; 24]).unwrap();
        assert_eq!(dir_size(&dir), 1024);
        assert_eq!(dir_size(&dir.join("missing")), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn limits_are_read_clamped_and_default_when_broken() {
        let dir = temp_dir("limits");
        let file = dir.join(LIMITS_FILE);
        assert_eq!(read_limits(&file), Limits::default());
        std::fs::write(&file, r#"{"web":1,"ipfs":1000000000000000}"#).unwrap();
        assert_eq!(read_limits(&file), Limits { web: MIN_LIMIT, ipfs: MAX_LIMIT });
        std::fs::write(&file, "not json").unwrap();
        assert_eq!(read_limits(&file), Limits::default());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
