//! Mesh-сети на компьютере — скачиваемый модуль, как Tor и IPFS.
//!
//! Радио-слой (USB-serial, TCP, Bluetooth LE) и узел Reticulum живут в
//! отдельной программе `bastyon-mesh` (crates/bastyon-mesh): mesh нужен не
//! всем, и без него приложению незачем держать в себе стек Reticulum, доступ
//! к портам и Bluetooth. Программу приложение скачивает по просьбе человека
//! (module.rs) и запускает, когда mesh нужен (host.rs). Команды `radio_*` и
//! `rns_*` (commands.rs) — прежние: интерфейс зовёт их как раньше, а
//! приложение передаёт их модулю. Нет модуля — ошибка `mesh_module_missing`,
//! интерфейс предлагает его скачать.
//!
//! На Android mesh встроен в приложение (плагины MeshRadio и MeshRns): там
//! запускать скачанный код нельзя.
//!
//! Событие для интерфейса: `mesh:install-progress` { received, total }.

pub mod commands;
mod host;
mod module;

use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;

use crate::fetch::download_client;
use crate::tor::TorManager;
use host::{Proc, SinkKind, Sinks};
use module::ModulePaths;

/// Когда после запуска приложения докачать модуль новой версии: не в первые
/// минуты, пока грузится лента и поднимается Tor.
const UPDATE_DELAYS: [Duration; 2] = [Duration::from_secs(60), Duration::from_secs(10 * 60)];

pub struct MeshManager {
    paths: ModulePaths,
    /// Каталог узлов Reticulum в данных приложения (у адреса — свой).
    rns_dir: PathBuf,
    proc: Mutex<Option<Arc<Proc>>>,
    starting: tokio::sync::Mutex<()>,
    sinks: Sinks,
    next_sink: AtomicU64,
    install_cancel: Mutex<Option<watch::Sender<bool>>>,
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?;
    let dir = data.join("mesh");
    std::fs::create_dir_all(&dir)?;
    let paths = ModulePaths::new(dir);
    paths.clean_leftovers();
    app.manage(MeshManager {
        paths,
        rns_dir: data.join("reticulum"),
        proc: Mutex::new(None),
        starting: tokio::sync::Mutex::new(()),
        sinks: host::new_sinks(),
        next_sink: AtomicU64::new(1),
        install_cancel: Mutex::new(None),
    });
    schedule_update(app.clone());
    Ok(())
}

/// Программа модуля для этой сборки: своя (переменная `BASTYON_MESH_MODULE`
/// или, в debug, собранная рядом с приложением) или скачанная.
fn dev_binary() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("BASTYON_MESH_MODULE") {
        return Some(PathBuf::from(path));
    }
    if cfg!(debug_assertions) {
        let exe = std::env::current_exe().ok()?;
        let name = if cfg!(windows) {
            "bastyon-mesh.exe"
        } else {
            "bastyon-mesh"
        };
        let sibling = exe.parent()?.join(name);
        return sibling.is_file().then_some(sibling);
    }
    None
}

impl MeshManager {
    /// Модуль и узлы Reticulum — для места на диске (crate::storage).
    pub fn disk_dirs(&self) -> [PathBuf; 2] {
        [self.paths.dir().to_path_buf(), self.rns_dir.clone()]
    }

    fn current(&self) -> Option<Arc<Proc>> {
        self.proc
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone()
            .filter(|p| p.alive())
    }

    /// Программа, которую запускать: скачанное обновление ставится сейчас.
    fn launch_binary(&self) -> Result<PathBuf, String> {
        if let Some(dev) = dev_binary() {
            return Ok(dev);
        }
        if let Some(pin) = module::pin() {
            if let Err(e) = self.paths.apply_staged(&pin) {
                log::warn!("[mesh] staged update: {e}");
            }
        }
        match self.paths.installed() {
            Some(_) => Ok(self.paths.binary()),
            None => Err("mesh_module_missing".into()),
        }
    }

    /// Модуль запущен — или запустить его.
    async fn ensure_running(&self) -> Result<Arc<Proc>, String> {
        if let Some(proc) = self.current() {
            return Ok(proc);
        }
        let _starting = self.starting.lock().await;
        if let Some(proc) = self.current() {
            return Ok(proc);
        }
        let binary = self.launch_binary()?;
        let proc = Proc::spawn(&binary, self.sinks.clone()).await?;
        *self.proc.lock().unwrap_or_else(|p| p.into_inner()) = Some(proc.clone());
        Ok(proc)
    }

    /// Команда модулю; модуль запускается, если ещё не запущен.
    pub(crate) async fn call(&self, cmd: &str, args: Value) -> Result<Value, String> {
        self.ensure_running().await?.request(cmd, args).await
    }

    /// Команда, ради которой модуль не запускают: не запущен — `None`.
    pub(crate) async fn call_if_running(
        &self,
        cmd: &str,
        args: Value,
    ) -> Option<Result<Value, String>> {
        let proc = self.current()?;
        Some(proc.request(cmd, args).await)
    }

    /// Команда, которая открывает соединение или узел: события пойдут в канал
    /// окна. Номер стока — до запроса: модуль может прислать событие раньше
    /// ответа.
    pub(crate) async fn call_with_sink(
        &self,
        cmd: &str,
        mut args: Value,
        kind: SinkKind,
        channel: Channel<Value>,
    ) -> Result<Value, String> {
        let proc = self.ensure_running().await?;
        let sink = self.next_sink.fetch_add(1, Ordering::SeqCst);
        host::add_sink(&self.sinks, sink, kind, channel);
        args["sink"] = sink.into();
        let result = proc.request(cmd, args).await;
        if result.is_err() {
            self.sinks.remove(&sink);
        }
        result
    }

    pub(crate) fn rns_dir(&self) -> &PathBuf {
        &self.rns_dir
    }

    /// Остановить модуль (удаление, выход из приложения).
    fn stop(&self) {
        let proc = self.proc.lock().unwrap_or_else(|p| p.into_inner()).take();
        if let Some(proc) = proc {
            proc.stop();
        }
    }

    fn installing(&self) -> bool {
        self.install_cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .is_some()
    }
}

/// Модуль прошлой версии приложения — докачать новый в фоне: человек уже
/// согласился на модуль, когда скачал его. Встанет при следующем запуске модуля.
fn schedule_update(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        for delay in UPDATE_DELAYS {
            tokio::time::sleep(delay).await;
            let mgr = app.state::<MeshManager>();
            let Some((pin, _)) = module::downloadable() else {
                return;
            };
            let outdated = mgr
                .paths
                .installed()
                .is_some_and(|m| m.sha256 != pin.sha256);
            if !outdated || mgr.paths.staged_for(&pin) || dev_binary().is_some() {
                return;
            }
            let Some(mut cancel) = mgr.begin_install() else {
                continue;
            };
            let tor = app.state::<TorManager>();
            let result = match download_client(&tor).await {
                Ok(client) => module::stage(&client, &mgr.paths, &mut cancel, |_, _| {}).await,
                Err(e) => Err(e),
            };
            mgr.end_install();
            match result {
                Ok(()) => {
                    log::info!("[mesh] module update downloaded");
                    return;
                }
                Err(e) => log::warn!("[mesh] module update: {e}"),
            }
        }
    });
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshModuleStatus {
    /// Модуль для этой сборки и платформы есть: его можно скачать.
    supported: bool,
    installed: bool,
    /// Установлен модуль этой версии приложения (или своя сборка).
    current: bool,
    installing: bool,
    /// Модуль запущен.
    running: bool,
    /// Сколько скачивать, байт.
    size: u64,
}

#[tauri::command]
pub fn mesh_module_status(mgr: State<'_, MeshManager>) -> MeshModuleStatus {
    let pin = module::downloadable().map(|(pin, _)| pin);
    let dev = dev_binary().is_some();
    let installed = mgr.paths.installed();
    MeshModuleStatus {
        supported: pin.is_some() || dev,
        installed: installed.is_some() || dev,
        current: dev
            || match (&installed, &pin) {
                (Some(m), Some(p)) => m.sha256 == p.sha256 || mgr.paths.staged_for(p),
                (Some(_), None) => true,
                _ => false,
            },
        installing: mgr.installing(),
        running: mgr.current().is_some(),
        size: pin.map(|p| p.size).unwrap_or(0),
    }
}

#[derive(Clone, Serialize)]
struct InstallProgress {
    received: u64,
    total: u64,
}

/// Скачать и поставить модуль этой версии. Прежний модуль останавливается,
/// только когда новый уже скачан: до того mesh работает.
#[tauri::command]
pub async fn mesh_module_install(
    app: AppHandle,
    mgr: State<'_, MeshManager>,
    tor: State<'_, TorManager>,
) -> Result<(), String> {
    let (pin, _) = module::downloadable().ok_or_else(|| "unsupported_platform".to_string())?;
    if mgr
        .paths
        .installed()
        .is_some_and(|m| m.sha256 == pin.sha256)
    {
        return Ok(());
    }
    let mut cancel = mgr.begin_install().ok_or_else(|| "busy".to_string())?;
    let result = async {
        let client = download_client(&tor).await?;
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        module::stage(&client, &mgr.paths, &mut cancel, |received, total| {
            if received == total || last_emit.elapsed() >= Duration::from_millis(100) {
                last_emit = Instant::now();
                let _ = app.emit("mesh:install-progress", InstallProgress { received, total });
            }
        })
        .await?;
        tokio::task::spawn_blocking(mgr.take_for_stop())
            .await
            .map_err(|e| format!("install_failed: {e}"))?;
        match mgr.paths.apply_staged(&pin) {
            Ok(true) => Ok(()),
            Ok(false) => Err("hash_mismatch: staged module".to_string()),
            Err(e) => Err(format!("install_failed: {e}")),
        }
    }
    .await;
    mgr.end_install();
    result
}

#[tauri::command]
pub fn mesh_module_cancel_install(mgr: State<'_, MeshManager>) {
    if let Some(tx) = mgr
        .install_cancel
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .as_ref()
    {
        let _ = tx.send(true);
    }
}

/// Удалить модуль: запущенный останавливается — радио отпускается, узел
/// Reticulum сохраняет известные адреса. Его данные (пути, очередь
/// сообщений) остаются: модуль вернётся к ним, если его скачать снова.
#[tauri::command]
pub async fn mesh_module_remove(mgr: State<'_, MeshManager>) -> Result<(), String> {
    if mgr.installing() {
        return Err("busy".into());
    }
    tokio::task::spawn_blocking(mgr.take_for_stop())
        .await
        .map_err(|e| format!("remove_failed: {e}"))?;
    mgr.paths
        .remove()
        .map_err(|e| format!("remove_failed: {e}"))
}

impl MeshManager {
    /// Занять загрузку: одна за раз — установка или обновление в фоне.
    fn begin_install(&self) -> Option<watch::Receiver<bool>> {
        let mut slot = self
            .install_cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        if slot.is_some() {
            return None;
        }
        let (tx, rx) = watch::channel(false);
        *slot = Some(tx);
        Some(rx)
    }

    fn end_install(&self) {
        *self
            .install_cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner()) = None;
    }

    /// Остановка для spawn_blocking: она ждёт модуль несколько секунд.
    fn take_for_stop(&self) -> impl FnOnce() + Send + 'static {
        let proc = self.proc.lock().unwrap_or_else(|p| p.into_inner()).take();
        move || {
            if let Some(proc) = proc {
                proc.stop();
            }
        }
    }
}

/// При выходе из приложения: модуль отпускает порты и Bluetooth, узел
/// Reticulum закрывает интерфейсы и сохраняет известные адреса.
pub fn shutdown_on_exit(mgr: &MeshManager) {
    mgr.stop();
}
