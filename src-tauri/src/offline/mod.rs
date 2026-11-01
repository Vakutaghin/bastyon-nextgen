//! Ролики для просмотра без сети, как в приложении YouTube.
//!
//! Список ведёт тот, кто качает: здесь — Rust, на Android — служба, в вебе —
//! воркер (src/services/offline-video). Страница только читает список и
//! подписана на события `offline://progress` (не чаще 4 раз в секунду) и
//! `offline://changed`. Откуда качать (архив, зеркала, прокси) решает
//! страница и отдаёт готовое задание (`Job`).
//!
//! Папка — `app_local_data_dir/offline`, не Caches: кэш чистит система и
//! программы-чистильщики, а скачанное человек ждёт найти и через месяц. Её
//! можно сменить на свою, например на другом диске (location.rs): на время
//! переноса загрузки встают и продолжаются уже на новом месте.
//! Качается до двух роликов сразу, остальные ждут. Под Tor — только через Tor
//! (`fetch::download_client`); Tor не готов — пауза с причиной, страница
//! продолжит, когда он поднимется.

pub mod download;
mod location;
pub mod protocol;
mod space;
pub mod store;

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State as TauriState};
use tokio::sync::watch;

use download::{DlError, Policy, Signal};
use store::{Item, Job, State, Status};

use crate::tor::TorManager;

/// Сколько роликов качается сразу.
const PARALLEL: usize = 2;
/// После запуска не мешаем ему: недокачанное продолжается чуть позже.
const RESUME_AFTER: Duration = Duration::from_secs(5);
const PROGRESS_EVERY: Duration = Duration::from_millis(250);

const EVENT_PROGRESS: &str = "offline://progress";
const EVENT_CHANGED: &str = "offline://changed";
const EVENT_MOVING: &str = "offline://moving";
/// Сколько ждать, пока загрузки встанут перед переносом.
const STOP_WAIT: Duration = Duration::from_secs(30);
const MAIN_WINDOW: &str = "main";

pub struct OfflineManager {
    /// Папка со скачанным сейчас; меняет только перенос.
    root: RwLock<PathBuf>,
    /// `app_local_data_dir`: там стандартная папка и настройка своей.
    base: PathBuf,
    /// Своя папка из настройки, которой нет на месте (диск не подключён).
    unavailable: Mutex<Option<PathBuf>>,
    /// Идёт перенос: загрузки не запускаются, список не меняется.
    moving: AtomicBool,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    running: HashMap<String, watch::Sender<Signal>>,
    queue: VecDeque<String>,
}

impl OfflineManager {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn root(&self) -> PathBuf {
        self.root.read().unwrap_or_else(|p| p.into_inner()).clone()
    }

    fn default_root(&self) -> PathBuf {
        self.base.join("offline")
    }

    fn moving(&self) -> bool {
        self.moving.load(Ordering::SeqCst)
    }

    fn not_moving(&self) -> Result<(), String> {
        if self.moving() {
            Err("moving".into())
        } else {
            Ok(())
        }
    }
}

#[derive(Clone, Serialize)]
struct Progress<'a> {
    id: &'a str,
    received: u64,
    total: u64,
}

#[derive(Clone, Serialize)]
struct Changed<'a> {
    id: &'a str,
    /// `None` — ролик удалён.
    item: Option<Item>,
}

fn emit_changed(app: &AppHandle, root: &Path, id: &str) {
    let item = store::read_item(root, id);
    let _ = app.emit_to(MAIN_WINDOW, EVENT_CHANGED, Changed { id, item });
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let base = app.path().app_local_data_dir()?;
    let default = base.join("offline");
    let (root, unavailable) = location::resolve(&default, location::read_config(&base));
    std::fs::create_dir_all(&root)?;
    let mut inner = Inner::default();
    for item in store::list(&root) {
        // Качалось или ждало при выходе — продолжим.
        if matches!(item.state.status, Status::Queued | Status::Downloading) {
            let dir = store::item_dir(&root, &item.id);
            let _ = store::write_state(
                &dir,
                &State {
                    status: Status::Queued,
                    ..item.state.clone()
                },
            );
            inner.queue.push_back(item.id);
        }
    }
    app.manage(OfflineManager {
        root: RwLock::new(root),
        base,
        unavailable: Mutex::new(unavailable),
        moving: AtomicBool::new(false),
        inner: Mutex::new(inner),
    });
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(RESUME_AFTER).await;
        pump(&handle);
    });
    Ok(())
}

/// Запустить ждущие, пока есть свободные места.
fn pump(app: &AppHandle) {
    let mgr = app.state::<OfflineManager>();
    if mgr.moving() {
        return;
    }
    let root = mgr.root();
    let mut inner = mgr.lock();
    while inner.running.len() < PARALLEL {
        let Some(id) = inner.queue.pop_front() else { break };
        if inner.running.contains_key(&id) {
            continue;
        }
        let dir = store::item_dir(&root, &id);
        let queued = store::read_state(&dir).is_some_and(|s| s.status == Status::Queued);
        if !queued {
            continue;
        }
        let (tx, rx) = watch::channel(Signal::Run);
        inner.running.insert(id.clone(), tx);
        let app = app.clone();
        tauri::async_runtime::spawn(async move { run_task(app, id, rx).await });
    }
}

/// Код ошибки клиента: Tor включён, но не готов — пауза до его готовности.
fn client_error_code(e: &str) -> &'static str {
    if e.starts_with(crate::tor::TOR_NOT_READY) {
        "tor_not_ready"
    } else {
        "network"
    }
}

async fn run_task(app: AppHandle, id: String, mut rx: watch::Receiver<Signal>) {
    let mgr = app.state::<OfflineManager>();
    let root = mgr.root();
    let dir = store::item_dir(&root, &id);
    let mut state = store::read_state(&dir).unwrap_or_else(|| State::queued(0));
    let result = match store::read_job(&dir) {
        None => Err((Status::Failed, Some("io".to_string()))),
        Some(job) => {
            state.status = Status::Downloading;
            state.error = None;
            let _ = store::write_state(&dir, &state);
            emit_changed(&app, &root, &id);
            let tor = app.state::<TorManager>();
            match crate::fetch::download_client(&tor).await {
                Err(e) => Err((Status::Paused, Some(client_error_code(&e).to_string()))),
                Ok(client) => download_job(&app, &client, &dir, &job, &mut state, &mut rx).await,
            }
        }
    };
    finish(&app, &id, &mut state, result, &rx);
    pump(&app);
}

async fn download_job(
    app: &AppHandle,
    client: &reqwest::Client,
    dir: &std::path::Path,
    job: &Job,
    state: &mut State,
    rx: &mut watch::Receiver<Signal>,
) -> Result<(), (Status, Option<String>)> {
    let mut last = Instant::now() - PROGRESS_EVERY;
    let mut report = |s: &State, persist: bool| {
        if persist {
            let _ = store::write_state(dir, s);
        }
        if persist || last.elapsed() >= PROGRESS_EVERY {
            last = Instant::now();
            let _ = app.emit_to(
                MAIN_WINDOW,
                EVENT_PROGRESS,
                Progress {
                    id: &job.id,
                    received: s.received,
                    total: s.total,
                },
            );
        }
    };
    let free_dir = dir.to_path_buf();
    let result = download::run(
        client,
        &Policy::default(),
        dir,
        job,
        state,
        rx,
        &mut report,
        move || space::free_bytes(&free_dir),
    )
    .await;
    match result {
        Ok(()) => Ok(()),
        Err(DlError::Stopped(_)) => Err((Status::Paused, None)),
        Err(e @ DlError::DiskFull) => Err((Status::Paused, Some(e.code().to_string()))),
        Err(e) => {
            log::warn!("[offline] {}: {e}", job.id);
            Err((Status::Failed, Some(e.code().to_string())))
        }
    }
}

/// Итог загрузки — под замком: «удалить» во время загрузки либо дошло до
/// задачи (и она удаляет сама), либо задачи уже нет и удаляет команда.
fn finish(
    app: &AppHandle,
    id: &str,
    state: &mut State,
    result: Result<(), (Status, Option<String>)>,
    rx: &watch::Receiver<Signal>,
) {
    let mgr = app.state::<OfflineManager>();
    let dir = store::item_dir(&mgr.root(), id);
    {
        let mut inner = mgr.lock();
        inner.running.remove(id);
        if *rx.borrow() == Signal::Remove {
            let _ = std::fs::remove_dir_all(&dir);
        } else {
            match result {
                Ok(()) => {
                    state.status = Status::Done;
                    state.received = state.total.max(state.received);
                    state.total = state.received;
                    state.error = None;
                }
                Err((status, error)) => {
                    state.status = status;
                    state.error = error;
                }
            }
            if dir.is_dir() {
                let _ = store::write_state(&dir, state);
            }
        }
    }
    emit_changed(app, &mgr.root(), id);
}

fn stop_or<F: FnOnce(&mut Inner)>(mgr: &OfflineManager, id: &str, signal: Signal, otherwise: F) {
    let mut inner = mgr.lock();
    if let Some(tx) = inner.running.get(id) {
        let _ = tx.send(signal);
    } else {
        otherwise(&mut inner);
    }
}

fn checked_id(id: &str) -> Result<(), String> {
    if store::valid_id(id) {
        Ok(())
    } else {
        Err("invalid_id".into())
    }
}

#[tauri::command]
pub fn offline_list(mgr: TauriState<'_, OfflineManager>) -> Vec<Item> {
    store::list(&mgr.root())
}

/// Поставить в очередь. Уже есть — вернуть как есть (страница сама допишет
/// аккаунт в `meta.accounts`).
#[tauri::command]
pub fn offline_enqueue(
    app: AppHandle,
    mgr: TauriState<'_, OfflineManager>,
    job: Job,
    meta: serde_json::Value,
) -> Result<Item, String> {
    mgr.not_moving()?;
    job.validate()?;
    if !meta.is_object() {
        return Err("invalid_meta".into());
    }
    let dir = store::item_dir(&mgr.root(), &job.id);
    if let Some(existing) = store::read_item(&mgr.root(), &job.id) {
        return Ok(existing);
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut meta = meta;
    meta["id"] = serde_json::Value::String(job.id.clone());
    store::write_job(&dir, &job).map_err(|e| e.to_string())?;
    store::write_state(&dir, &State::queued(job.size)).map_err(|e| e.to_string())?;
    // meta.json последним: без него папку не видно в списке.
    store::write_meta(&dir, &meta).map_err(|e| e.to_string())?;
    mgr.lock().queue.push_back(job.id.clone());
    emit_changed(&app, &mgr.root(), &job.id);
    pump(&app);
    store::read_item(&mgr.root(), &job.id).ok_or_else(|| "io".to_string())
}

#[tauri::command]
pub fn offline_pause(app: AppHandle, mgr: TauriState<'_, OfflineManager>, id: String) -> Result<(), String> {
    checked_id(&id)?;
    let root = mgr.root();
    let mut changed = false;
    stop_or(&mgr, &id, Signal::Pause, |inner| {
        inner.queue.retain(|q| q != &id);
        let dir = store::item_dir(&root, &id);
        if let Some(mut state) = store::read_state(&dir) {
            if state.status == Status::Queued {
                state.status = Status::Paused;
                state.error = None;
                changed = store::write_state(&dir, &state).is_ok();
            }
        }
    });
    if changed {
        emit_changed(&app, &root, &id);
    }
    Ok(())
}

/// Продолжить приостановленное или упавшее (кнопка «Повторить»).
#[tauri::command]
pub fn offline_resume(app: AppHandle, mgr: TauriState<'_, OfflineManager>, id: String) -> Result<(), String> {
    checked_id(&id)?;
    mgr.not_moving()?;
    let dir = store::item_dir(&mgr.root(), &id);
    {
        let mut inner = mgr.lock();
        if inner.running.contains_key(&id) || inner.queue.contains(&id) {
            return Ok(());
        }
        // Состояние потерялось, а задание на месте — качаем заново.
        if store::read_job(&dir).is_none() {
            return Err("not_found".into());
        }
        let mut state = store::read_state(&dir).unwrap_or_else(|| State::queued(0));
        if state.status == Status::Done && dir.join(store::VIDEO).is_file() {
            return Ok(());
        }
        state.status = Status::Queued;
        state.error = None;
        store::write_state(&dir, &state).map_err(|e| e.to_string())?;
        inner.queue.push_back(id.clone());
    }
    emit_changed(&app, &mgr.root(), &id);
    pump(&app);
    Ok(())
}

/// Удалить ролик или отменить загрузку (с недокачанным).
#[tauri::command]
pub fn offline_remove(app: AppHandle, mgr: TauriState<'_, OfflineManager>, id: String) -> Result<(), String> {
    checked_id(&id)?;
    mgr.not_moving()?;
    let root = mgr.root();
    let mut removed = false;
    stop_or(&mgr, &id, Signal::Remove, |inner| {
        inner.queue.retain(|q| q != &id);
        removed = std::fs::remove_dir_all(store::item_dir(&root, &id)).is_ok();
    });
    if removed {
        emit_changed(&app, &root, &id);
    }
    Ok(())
}

/// Поля `meta.json`: аккаунты, «автор удалил», дата проверки.
#[tauri::command]
pub fn offline_patch_meta(
    app: AppHandle,
    mgr: TauriState<'_, OfflineManager>,
    id: String,
    patch: serde_json::Value,
) -> Result<Item, String> {
    checked_id(&id)?;
    mgr.not_moving()?;
    store::patch_meta(&store::item_dir(&mgr.root(), &id), &patch)?;
    emit_changed(&app, &mgr.root(), &id);
    store::read_item(&mgr.root(), &id).ok_or_else(|| "not_found".to_string())
}

#[derive(Serialize)]
pub struct Usage {
    used: u64,
    free: Option<u64>,
}

#[tauri::command]
pub async fn offline_usage(mgr: TauriState<'_, OfflineManager>) -> Result<Usage, String> {
    let root = mgr.root();
    tauri::async_runtime::spawn_blocking(move || Usage {
        used: crate::storage::dir_size(&root),
        free: space::free_bytes(&root),
    })
    .await
    .map_err(|e| e.to_string())
}

/// Стереть всё скачанное (выход из всех аккаунтов, «Удалить всё»).
#[tauri::command]
pub fn offline_clear(app: AppHandle, mgr: TauriState<'_, OfflineManager>) -> Result<(), String> {
    mgr.not_moving()?;
    let ids: Vec<String> = store::list(&mgr.root()).into_iter().map(|i| i.id).collect();
    for id in ids {
        offline_remove(app.clone(), mgr.clone(), id)?;
    }
    Ok(())
}

/// Где лежит скачанное — для настроек.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    path: String,
    is_default: bool,
    /// Своя папка, которой нет на месте: скачанное с неё не видно.
    unavailable: Option<String>,
    free: Option<u64>,
}

fn location_of(mgr: &OfflineManager) -> Location {
    let root = mgr.root();
    Location {
        path: root.to_string_lossy().into_owned(),
        is_default: root == mgr.default_root(),
        unavailable: mgr
            .unavailable
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .as_ref()
            .map(|p| p.to_string_lossy().into_owned()),
        free: space::free_bytes(&root),
    }
}

#[tauri::command]
pub async fn offline_location(app: AppHandle) -> Result<Location, String> {
    tauri::async_runtime::spawn_blocking(move || location_of(&app.state::<OfflineManager>()))
        .await
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct Moving {
    done: usize,
    total: usize,
}

/// Остановить загрузки перед переносом. Возвращает, что качалось и ждало, —
/// это вернётся в очередь после него, — и встало ли всё за STOP_WAIT.
async fn stop_all(mgr: &OfflineManager) -> (Vec<String>, bool) {
    let resume: Vec<String> = {
        let mut inner = mgr.lock();
        for tx in inner.running.values() {
            let _ = tx.send(Signal::Pause);
        }
        let mut ids: Vec<String> = inner.running.keys().cloned().collect();
        ids.extend(inner.queue.drain(..));
        ids
    };
    let started = Instant::now();
    while !mgr.lock().running.is_empty() {
        if started.elapsed() > STOP_WAIT {
            return (resume, false);
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    (resume, true)
}

/// Остановленное переносом — снова в очередь, уже там, где теперь скачанное.
fn requeue(app: &AppHandle, ids: Vec<String>) {
    let mgr = app.state::<OfflineManager>();
    let root = mgr.root();
    {
        let mut inner = mgr.lock();
        for id in ids {
            let dir = store::item_dir(&root, &id);
            let Some(mut state) = store::read_state(&dir) else { continue };
            // Done — докачалось, пока вставало; ещё качается (не встало) — само продолжит.
            if state.status == Status::Done || inner.running.contains_key(&id) {
                continue;
            }
            state.status = Status::Queued;
            state.error = None;
            if store::write_state(&dir, &state).is_ok() && !inner.queue.contains(&id) {
                inner.queue.push_back(id);
            }
        }
    }
    pump(app);
}

/// Перенести скачанное в папку `to` (в ней — подпапка `Bastyon offline`) или,
/// без `to`, обратно в стандартную. Ошибки: `moving`, `busy`, `inside_current`,
/// `not_writable`, `no_space`, `target_busy`, `io` — тогда всё остаётся как было.
#[tauri::command]
pub async fn offline_move(app: AppHandle, to: Option<String>) -> Result<Location, String> {
    let mgr = app.state::<OfflineManager>();
    let chosen = to.filter(|p| !p.trim().is_empty()).map(PathBuf::from);
    let target = chosen
        .as_ref()
        .map_or_else(|| mgr.default_root(), |p| p.join(location::SUBDIR));
    let current = mgr.root();
    if target == current {
        // Та же папка — разве что забыть недоступную, если выбрали стандартную.
        if chosen.is_none() {
            location::write_config(&mgr.base, None).map_err(|e| e.to_string())?;
            *mgr.unavailable.lock().unwrap_or_else(|p| p.into_inner()) = None;
        }
        return Ok(location_of(&mgr));
    }
    if mgr.moving.swap(true, Ordering::SeqCst) {
        return Err("moving".into());
    }
    let (resume, stopped) = stop_all(&mgr).await;
    if !stopped {
        mgr.moving.store(false, Ordering::SeqCst);
        requeue(&app, resume);
        return Err("busy".into());
    }
    let handle = app.clone();
    let (from, dest) = (current.clone(), target.clone());
    let moved = tauri::async_runtime::spawn_blocking(move || {
        location::check_target(&from, &dest)?;
        let ids: Vec<String> = store::list(&from).into_iter().map(|i| i.id).collect();
        if !location::same_device(&from, &dest)
            && !location::enough_space(crate::storage::dir_size(&from), space::free_bytes(&dest))
        {
            return Err("no_space".to_string());
        }
        location::move_items(&from, &dest, &ids, |done, total| {
            let _ = handle.emit_to(MAIN_WINDOW, EVENT_MOVING, Moving { done, total });
        })
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    if moved.is_ok() {
        *mgr.root.write().unwrap_or_else(|p| p.into_inner()) = target.clone();
        *mgr.unavailable.lock().unwrap_or_else(|p| p.into_inner()) = None;
        if let Err(e) = location::write_config(&mgr.base, chosen.as_deref()) {
            log::warn!("[offline] location config: {e}");
        }
        // Своя папка опустела — убрать её; стандартная остаётся.
        if current != mgr.default_root() {
            let _ = std::fs::remove_dir(&current);
        }
    }
    mgr.moving.store(false, Ordering::SeqCst);
    requeue(&app, resume);
    moved.map(|()| location_of(&mgr))
}

/// Обработчик схемы `bastyon-offline://` для `register_asynchronous_uri_scheme_protocol`.
pub fn handle_protocol<R: tauri::Runtime>(
    ctx: tauri::UriSchemeContext<'_, R>,
    request: http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    if ctx.webview_label() != MAIN_WINDOW {
        responder.respond(
            http::Response::builder()
                .status(http::StatusCode::FORBIDDEN)
                .body(Vec::new())
                .unwrap_or_default(),
        );
        return;
    }
    let Some(mgr) = ctx.app_handle().try_state::<OfflineManager>() else {
        responder.respond(
            http::Response::builder()
                .status(http::StatusCode::SERVICE_UNAVAILABLE)
                .body(Vec::new())
                .unwrap_or_default(),
        );
        return;
    };
    let root = mgr.root();
    tauri::async_runtime::spawn_blocking(move || {
        responder.respond(protocol::respond(&root, &request));
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn tor_not_ready_pauses_instead_of_failing() {
        let e = format!("{}: status=Bootstrapping", crate::tor::TOR_NOT_READY);
        assert_eq!(super::client_error_code(&e), "tor_not_ready");
        assert_eq!(super::client_error_code("download_failed: dns"), "network");
    }
}
