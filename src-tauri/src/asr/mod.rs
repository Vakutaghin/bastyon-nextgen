//! Голосовой ввод: распознавание речи прямо на компьютере (whisper.cpp).
//!
//! Запись и распознавание не покидают устройство: микрофон → 16 кГц → нарезка
//! на фразы по паузам (Silero) → whisper → текст в поле ввода. Сеть нужна
//! один раз — скачать модель, и под Tor это идёт через Tor.
//!
//! События для интерфейса:
//! - `asr:install-progress` { model, received, total } — скачивание модели;
//! - `asr:level` { session, level, speaking } — громкость 0..1, ~20 раз в секунду;
//! - `asr:state` { session, loading, pending } — модель грузится / фраз в очереди;
//! - `asr:text` { session, seq, text } — распознанная фраза, по порядку;
//! - `asr:end` { session, reason, error } — сессия закончилась
//!   (stopped | cancelled | error).

mod capture;
mod engine;
mod keep_awake;
pub mod models;
mod resample;
mod segmenter;

use models::{model_spec, AsrPaths, ModelSpec, MODELS, VAD_MODEL};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;

use crate::tor::state::TorStatus;
use crate::tor::TorManager;

/// Модель выгружается из памяти после такого простоя.
const ENGINE_IDLE: Duration = Duration::from_secs(5 * 60);
/// Первые секунды микрофона из одних точных нулей: macOS так отдаёт звук,
/// когда доступ к микрофону запрещён (или микрофон выключен кнопкой).
const SILENT_MIC_SECS: f32 = 1.5;
const LEVEL_EVERY: Duration = Duration::from_millis(50);

// ---------------------------------------------------------------------------
// Рабочий поток распознавания: владеет моделью, берёт фразы по очереди.
// ---------------------------------------------------------------------------

enum EngineJob {
    Warmup {
        model_file: String,
        done: mpsc::Sender<Result<(), String>>,
    },
    Transcribe {
        model_file: String,
        samples: Vec<f32>,
        language: String,
        prompt: String,
        cancelled: Arc<AtomicBool>,
        reply: mpsc::Sender<Result<String, String>>,
    },
}

struct EngineWorker {
    tx: Mutex<Option<mpsc::Sender<EngineJob>>>,
}

impl EngineWorker {
    fn new() -> Self {
        Self {
            tx: Mutex::new(None),
        }
    }

    fn send(&self, job: EngineJob) {
        let mut guard = self.tx.lock().unwrap_or_else(|p| p.into_inner());
        let job = match guard.as_ref() {
            Some(tx) => match tx.send(job) {
                Ok(()) => return,
                // Поток распознавания упал — поднимаем новый.
                Err(mpsc::SendError(job)) => job,
            },
            None => job,
        };
        let (tx, rx) = mpsc::channel();
        let spawned = std::thread::Builder::new()
            .name("asr-engine".into())
            .spawn(move || engine_loop(rx));
        if spawned.is_ok() {
            let _ = tx.send(job);
            *guard = Some(tx);
        }
    }
}

/// Загрузить модель, если в памяти другая или никакой.
fn ensure_engine(engine: &mut Option<engine::Engine>, file: &str) -> Result<(), String> {
    if engine.as_ref().map(|e| e.model_file() != file).unwrap_or(true) {
        // Сначала освобождаем прежнюю: две модели в памяти разом не нужны.
        *engine = None;
        *engine = Some(engine::Engine::load(file)?);
    }
    Ok(())
}

fn engine_loop(rx: mpsc::Receiver<EngineJob>) {
    let mut engine: Option<engine::Engine> = None;
    loop {
        match rx.recv_timeout(ENGINE_IDLE) {
            Ok(EngineJob::Warmup { model_file, done }) => {
                let _ = done.send(ensure_engine(&mut engine, &model_file));
            }
            Ok(EngineJob::Transcribe {
                model_file,
                samples,
                language,
                prompt,
                cancelled,
                reply,
            }) => {
                if cancelled.load(Ordering::Relaxed) {
                    continue;
                }
                let result = ensure_engine(&mut engine, &model_file).and_then(|_| {
                    engine
                        .as_ref()
                        .expect("engine just loaded")
                        .transcribe(&samples, &language, &prompt)
                });
                let _ = reply.send(result);
            }
            // Простой: освобождаем память, поток остаётся ждать новых фраз.
            Err(mpsc::RecvTimeoutError::Timeout) => engine = None,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

// ---------------------------------------------------------------------------
// Менеджер и команды
// ---------------------------------------------------------------------------

struct SessionControl {
    id: u32,
    cmd: mpsc::Sender<SessionCmd>,
}

enum SessionCmd {
    Stop,
    Cancel,
}

pub struct AsrManager {
    paths: AsrPaths,
    engine: Arc<EngineWorker>,
    session: Mutex<Option<SessionControl>>,
    next_session: AtomicU32,
    install_cancel: Mutex<Option<watch::Sender<bool>>>,
    installing: Mutex<Option<String>>,
}

impl AsrManager {
    fn new(paths: AsrPaths) -> Self {
        Self {
            paths,
            engine: Arc::new(EngineWorker::new()),
            session: Mutex::new(None),
            next_session: AtomicU32::new(1),
            install_cancel: Mutex::new(None),
            installing: Mutex::new(None),
        }
    }
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app
        .path()
        .app_data_dir()
        .or_else(|_| app.path().app_local_data_dir())?
        .join("asr");
    std::fs::create_dir_all(&dir)?;
    // Недокачанное с прошлого запуска.
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "part").unwrap_or(false) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    app.manage(AsrManager::new(AsrPaths::new(dir)));
    Ok(())
}

/// Остановить запись при выходе: микрофон не должен оставаться открытым.
pub fn shutdown_on_exit(mgr: &AsrManager) {
    if let Some(s) = mgr.session.lock().unwrap_or_else(|p| p.into_inner()).take() {
        let _ = s.cmd.send(SessionCmd::Cancel);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrModelInfo {
    id: &'static str,
    size: u64,
    installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrStatus {
    /// Процессор подходит (x86-64 без AVX2 — нет).
    supported: bool,
    /// Считает видеокарта (Metal на Apple Silicon).
    gpu: bool,
    models: Vec<AsrModelInfo>,
    /// Какая модель сейчас скачивается.
    installing: Option<String>,
}

#[tauri::command]
pub fn asr_status(mgr: State<'_, AsrManager>) -> AsrStatus {
    let installed = mgr.paths.installed_models();
    AsrStatus {
        supported: engine::cpu_supported(),
        gpu: engine::use_gpu(),
        models: MODELS
            .iter()
            .map(|m| AsrModelInfo {
                id: m.id,
                size: m.size + if mgr.paths.is_installed(&VAD_MODEL) { 0 } else { VAD_MODEL.size },
                installed: installed.contains(&m.id),
            })
            .collect(),
        installing: mgr.installing.lock().unwrap_or_else(|p| p.into_inner()).clone(),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    model: String,
    received: u64,
    total: u64,
}

/// Клиент для скачивания: под Tor — только через Tor (fail-closed, как у
/// остальных запросов приложения), без Tor — напрямую.
async fn download_client(tor: &TorManager) -> Result<reqwest::Client, String> {
    let st = tor.state.read().await;
    let builder = reqwest::Client::builder()
        .user_agent("Bastyon/1.0")
        .connect_timeout(Duration::from_secs(30));
    let builder = match st.status {
        TorStatus::Off => builder,
        TorStatus::Ready => builder.proxy(
            reqwest::Proxy::all(format!("socks5h://127.0.0.1:{}", st.socks_port))
                .map_err(|e| format!("download_failed: {e}"))?,
        ),
        other => return Err(format!("{}: status={other:?}", crate::tor::TOR_NOT_READY)),
    };
    builder.build().map_err(|e| format!("download_failed: {e}"))
}

/// Скачать модель (и детектор речи, если его ещё нет).
#[tauri::command]
pub async fn asr_install(
    app: AppHandle,
    mgr: State<'_, AsrManager>,
    tor: State<'_, TorManager>,
    model: String,
) -> Result<(), String> {
    let spec = model_spec(&model).ok_or_else(|| "unknown_model".to_string())?;
    let (cancel_tx, mut cancel_rx) = watch::channel(false);
    {
        let mut slot = mgr.install_cancel.lock().unwrap_or_else(|p| p.into_inner());
        if slot.is_some() {
            return Err("busy".into());
        }
        *slot = Some(cancel_tx);
    }
    *mgr.installing.lock().unwrap_or_else(|p| p.into_inner()) = Some(model.clone());

    let result = async {
        let client = download_client(&tor).await?;
        let need_vad = !mgr.paths.is_installed(&VAD_MODEL);
        let need_model = !mgr.paths.is_installed(spec);
        let total = if need_vad { VAD_MODEL.size } else { 0 } + if need_model { spec.size } else { 0 };
        let mut done: u64 = 0;
        let mut last_emit = Instant::now() - LEVEL_EVERY;
        let mut steps: Vec<&ModelSpec> = Vec::new();
        if need_vad {
            steps.push(&VAD_MODEL);
        }
        if need_model {
            steps.push(spec);
        }
        for step in steps {
            let dest = mgr.paths.file(step);
            models::download(&client, step, &dest, &mut cancel_rx, |received, _| {
                if last_emit.elapsed() >= Duration::from_millis(100) || received == step.size {
                    last_emit = Instant::now();
                    let _ = app.emit(
                        "asr:install-progress",
                        InstallProgress {
                            model: model.clone(),
                            received: done + received,
                            total,
                        },
                    );
                }
            })
            .await
            .map_err(|e| e.to_string())?;
            done += step.size;
        }
        Ok::<(), String>(())
    }
    .await;

    *mgr.install_cancel.lock().unwrap_or_else(|p| p.into_inner()) = None;
    *mgr.installing.lock().unwrap_or_else(|p| p.into_inner()) = None;
    result
}

#[tauri::command]
pub fn asr_cancel_install(mgr: State<'_, AsrManager>) {
    if let Some(tx) = mgr.install_cancel.lock().unwrap_or_else(|p| p.into_inner()).as_ref() {
        let _ = tx.send(true);
    }
}

/// Удалить модель. Последняя уходит вместе с детектором речи.
#[tauri::command]
pub fn asr_remove(mgr: State<'_, AsrManager>, model: String) -> Result<(), String> {
    let spec = model_spec(&model).ok_or_else(|| "unknown_model".to_string())?;
    if let Some(s) = mgr.session.lock().unwrap_or_else(|p| p.into_inner()).take() {
        let _ = s.cmd.send(SessionCmd::Cancel);
    }
    let path = mgr.paths.file(spec);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("remove_failed: {e}"))?;
    }
    if mgr.paths.installed_models().is_empty() {
        let _ = std::fs::remove_file(mgr.paths.file(&VAD_MODEL));
    }
    Ok(())
}

/// Коды языков интерфейса → коды whisper.
fn whisper_language(lang: &str) -> String {
    let code = match lang {
        "kr" => "ko",
        other => other,
    };
    if whisper_rs::get_lang_id(code).is_some() {
        code.to_string()
    } else {
        "auto".to_string()
    }
}

/// Начать диктовку. Возвращает id сессии; прежняя сессия отменяется.
#[tauri::command]
pub fn asr_start(
    app: AppHandle,
    mgr: State<'_, AsrManager>,
    model: String,
    language: String,
    prompt: String,
) -> Result<u32, String> {
    if !engine::cpu_supported() {
        return Err("unsupported_cpu".into());
    }
    let spec = model_spec(&model).ok_or_else(|| "unknown_model".to_string())?;
    if !mgr.paths.is_installed(spec) || !mgr.paths.is_installed(&VAD_MODEL) {
        return Err("model_missing".into());
    }
    let id = mgr.next_session.fetch_add(1, Ordering::Relaxed);
    let (cmd_tx, cmd_rx) = mpsc::channel();
    {
        let mut slot = mgr.session.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(prev) = slot.take() {
            let _ = prev.cmd.send(SessionCmd::Cancel);
        }
        *slot = Some(SessionControl { id, cmd: cmd_tx });
    }
    let session = Session {
        app: app.clone(),
        id,
        model_file: mgr.paths.file(spec).to_string_lossy().to_string(),
        vad_file: mgr.paths.file(&VAD_MODEL).to_string_lossy().to_string(),
        language: whisper_language(&language),
        context: prompt,
        engine: mgr.engine.clone(),
    };
    std::thread::Builder::new()
        .name("asr-session".into())
        .spawn(move || session.run(cmd_rx))
        .map_err(|e| format!("engine_error: {e}"))?;
    Ok(id)
}

fn send_session(mgr: &AsrManager, session: u32, cmd: SessionCmd) {
    let slot = mgr.session.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(s) = slot.as_ref().filter(|s| s.id == session) {
        let _ = s.cmd.send(cmd);
    }
}

/// Закончить: дораспознать сказанное и закрыть микрофон.
#[tauri::command]
pub fn asr_stop(mgr: State<'_, AsrManager>, session: u32) {
    send_session(&mgr, session, SessionCmd::Stop);
}

/// Прервать без распознавания хвоста.
#[tauri::command]
pub fn asr_cancel(mgr: State<'_, AsrManager>, session: u32) {
    send_session(&mgr, session, SessionCmd::Cancel);
}

// ---------------------------------------------------------------------------
// Сессия диктовки
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LevelEvent {
    session: u32,
    level: f32,
    speaking: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StateEvent {
    session: u32,
    loading: bool,
    pending: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TextEvent {
    session: u32,
    seq: u32,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EndEvent {
    session: u32,
    reason: &'static str,
    error: Option<String>,
}

/// Нарезка на фразы в своём потоке. Детектор может надолго задуматься
/// (первая загрузка Metal держит общую инициализацию ggml, занятый процессор),
/// а запись с микрофона и индикатор громкости ждать не должны: звук копится в
/// канале, детектор его догоняет.
struct VadWorker {
    input: Option<mpsc::Sender<VadInput>>,
    output: mpsc::Receiver<Result<Vec<f32>, String>>,
    speaking: Arc<AtomicBool>,
}

enum VadInput {
    Samples(Vec<f32>),
    Finish,
}

impl VadWorker {
    fn spawn(vad_file: String) -> Self {
        let (in_tx, in_rx) = mpsc::channel::<VadInput>();
        let (out_tx, out_rx) = mpsc::channel();
        let speaking = Arc::new(AtomicBool::new(false));
        let flag = speaking.clone();
        let spawned = std::thread::Builder::new()
            .name("asr-vad".into())
            .spawn(move || {
                let detector = match engine::SileroDetector::load(&vad_file) {
                    Ok(d) => d,
                    Err(e) => {
                        let _ = out_tx.send(Err(e));
                        return;
                    }
                };
                let mut segmenter = segmenter::Segmenter::new(detector);
                while let Ok(input) = in_rx.recv() {
                    let result = match input {
                        VadInput::Samples(samples) => segmenter.push(&samples),
                        VadInput::Finish => {
                            match segmenter.finish() {
                                Ok(Some(tail)) => {
                                    let _ = out_tx.send(Ok(tail));
                                }
                                Ok(None) => {}
                                Err(e) => {
                                    let _ = out_tx.send(Err(e));
                                }
                            }
                            break;
                        }
                    };
                    flag.store(segmenter.speaking(), Ordering::Relaxed);
                    match result {
                        Ok(utterances) => {
                            for u in utterances {
                                if out_tx.send(Ok(u)).is_err() {
                                    return;
                                }
                            }
                        }
                        Err(e) => {
                            let _ = out_tx.send(Err(e));
                            return;
                        }
                    }
                }
            });
        if let Err(e) = spawned {
            let (err_tx, err_rx) = mpsc::channel();
            let _ = err_tx.send(Err(format!("engine_error: {e}")));
            return Self {
                input: None,
                output: err_rx,
                speaking,
            };
        }
        Self {
            input: Some(in_tx),
            output: out_rx,
            speaking,
        }
    }

    fn speaking(&self) -> bool {
        self.speaking.load(Ordering::Relaxed)
    }

    fn push(&self, samples: Vec<f32>) {
        if let Some(tx) = &self.input {
            let _ = tx.send(VadInput::Samples(samples));
        }
    }

    /// Готовая фраза, если есть; ошибка детектора заканчивает сессию.
    fn try_next(&self) -> Result<Option<Vec<f32>>, String> {
        match self.output.try_recv() {
            Ok(Ok(u)) => Ok(Some(u)),
            Ok(Err(e)) => Err(e),
            Err(_) => Ok(None),
        }
    }

    /// Запись закончена: дождаться, пока детектор дорежет накопленное.
    fn finish(mut self) -> Result<Vec<Vec<f32>>, String> {
        if let Some(tx) = self.input.take() {
            let _ = tx.send(VadInput::Finish);
        }
        let mut out = Vec::new();
        // Поток детектора закрывает канал, когда отдал последнюю фразу.
        for item in self.output.iter() {
            out.push(item?);
        }
        Ok(out)
    }
}

struct Session {
    app: AppHandle,
    id: u32,
    model_file: String,
    vad_file: String,
    language: String,
    /// Текст перед курсором и уже распознанное — подсказка модели.
    context: String,
    engine: Arc<EngineWorker>,
}

type Pending = VecDeque<(u32, mpsc::Receiver<Result<String, String>>)>;

/// Громкость фрагмента 0..1: -60 дБ и тише — ноль, -10 дБ — максимум.
fn level_of(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();
    let db = 20.0 * rms.max(1e-9).log10();
    ((db + 60.0) / 50.0).clamp(0.0, 1.0)
}

impl Session {
    fn run(mut self, cmd: mpsc::Receiver<SessionCmd>) {
        let (reason, error) = match self.listen(cmd) {
            Ok(reason) => (reason, None),
            Err(e) => ("error", Some(e)),
        };
        if let Some(e) = &error {
            log::warn!("asr session {}: {e}", self.id);
        }
        // Сессия больше не активна: следующий asr_stop с этим id ничего не сделает.
        if let Some(mgr) = self.app.try_state::<AsrManager>() {
            let mut slot = mgr.session.lock().unwrap_or_else(|p| p.into_inner());
            if slot.as_ref().map(|s| s.id == self.id).unwrap_or(false) {
                *slot = None;
            }
        }
        let _ = self.app.emit(
            "asr:end",
            EndEvent {
                session: self.id,
                reason,
                error,
            },
        );
    }

    fn listen(&mut self, cmd: mpsc::Receiver<SessionCmd>) -> Result<&'static str, String> {
        let _awake = keep_awake::KeepAwake::begin("Voice input");
        // Модель грузится, пока человек начинает говорить.
        let (warm_tx, warm_rx) = mpsc::channel();
        self.engine.send(EngineJob::Warmup {
            model_file: self.model_file.clone(),
            done: warm_tx,
        });
        let mut loading = true;
        self.emit_state(true, 0);

        let vad = VadWorker::spawn(self.vad_file.clone());
        let (audio_tx, audio_rx) = mpsc::channel::<Vec<f32>>();
        let (err_tx, err_rx) = mpsc::channel::<String>();
        let (capture, rate) = capture::start(audio_tx, err_tx)?;
        let mut resampler = resample::Resampler::new(rate);

        let cancelled = Arc::new(AtomicBool::new(false));
        let mut pending: Pending = VecDeque::new();
        let mut seq: u32 = 0;
        let mut last_level = Instant::now() - LEVEL_EVERY;
        let mut heard_samples: usize = 0;
        let mut heard_sound = false;

        let outcome = loop {
            match cmd.try_recv() {
                Ok(SessionCmd::Stop) => break "stopped",
                Ok(SessionCmd::Cancel) | Err(mpsc::TryRecvError::Disconnected) => break "cancelled",
                Err(mpsc::TryRecvError::Empty) => {}
            }
            if let Ok(e) = err_rx.try_recv() {
                cancelled.store(true, Ordering::Relaxed);
                return Err(e);
            }
            if loading {
                match warm_rx.try_recv() {
                    Ok(Ok(())) => {
                        loading = false;
                        self.emit_state(false, pending.len() as u32);
                    }
                    Ok(Err(e)) => {
                        cancelled.store(true, Ordering::Relaxed);
                        return Err(e);
                    }
                    Err(_) => {}
                }
            }
            match audio_rx.recv_timeout(Duration::from_millis(40)) {
                Ok(chunk) => {
                    if !heard_sound {
                        heard_sound = chunk.iter().any(|s| *s != 0.0);
                        heard_samples += chunk.len();
                        if !heard_sound && heard_samples as f32 >= rate as f32 * SILENT_MIC_SECS {
                            return Err("mic_denied".into());
                        }
                    }
                    let samples = resampler.process(&chunk);
                    if last_level.elapsed() >= LEVEL_EVERY {
                        last_level = Instant::now();
                        let _ = self.app.emit(
                            "asr:level",
                            LevelEvent {
                                session: self.id,
                                level: level_of(&samples),
                                speaking: vad.speaking(),
                            },
                        );
                    }
                    vad.push(samples);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("mic_error: capture stopped".into());
                }
            }
            while let Some(utterance) = vad.try_next()? {
                self.submit(utterance, &cancelled, &mut pending, &mut seq, loading);
            }
            self.collect(&mut pending, false, loading)?;
        };
        drop(capture);

        if outcome == "cancelled" {
            cancelled.store(true, Ordering::Relaxed);
            return Ok(outcome);
        }
        let _ = self.app.emit(
            "asr:level",
            LevelEvent {
                session: self.id,
                level: 0.0,
                speaking: false,
            },
        );
        // Хвост: детектор дорабатывает накопленное и отдаёт последнюю фразу.
        for utterance in vad.finish()? {
            self.submit(utterance, &cancelled, &mut pending, &mut seq, loading);
        }
        if loading {
            match warm_rx.recv() {
                Ok(Err(e)) => return Err(e),
                _ => self.emit_state(false, pending.len() as u32),
            }
        }
        self.collect(&mut pending, true, false)?;
        Ok(outcome)
    }

    fn submit(
        &mut self,
        samples: Vec<f32>,
        cancelled: &Arc<AtomicBool>,
        pending: &mut Pending,
        seq: &mut u32,
        loading: bool,
    ) {
        let (reply, rx) = mpsc::channel();
        self.engine.send(EngineJob::Transcribe {
            model_file: self.model_file.clone(),
            samples,
            language: self.language.clone(),
            prompt: self.context.clone(),
            cancelled: cancelled.clone(),
            reply,
        });
        pending.push_back((*seq, rx));
        *seq += 1;
        self.emit_state(loading, pending.len() as u32);
    }

    /// Отдать готовые фразы по порядку; `wait` — дождаться всех.
    fn collect(&mut self, pending: &mut Pending, wait: bool, loading: bool) -> Result<(), String> {
        let before = pending.len();
        while let Some((seq, rx)) = pending.front() {
            let result = if wait {
                rx.recv().map_err(|_| "engine_error: worker stopped".to_string())?
            } else {
                match rx.try_recv() {
                    Ok(r) => r,
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => {
                        return Err("engine_error: worker stopped".into())
                    }
                }
            };
            let seq = *seq;
            pending.pop_front();
            let text = result?;
            if !text.is_empty() {
                self.context.push(' ');
                self.context.push_str(&text);
                let _ = self.app.emit(
                    "asr:text",
                    TextEvent {
                        session: self.id,
                        seq,
                        text,
                    },
                );
            }
        }
        if pending.len() != before {
            self.emit_state(loading, pending.len() as u32);
        }
        Ok(())
    }

    fn emit_state(&self, loading: bool, pending: u32) {
        let _ = self.app.emit(
            "asr:state",
            StateEvent {
                session: self.id,
                loading,
                pending,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn languages_map_to_whisper_codes() {
        assert_eq!(whisper_language("ru"), "ru");
        assert_eq!(whisper_language("kr"), "ko");
        assert_eq!(whisper_language("zh"), "zh");
        assert_eq!(whisper_language("sr"), "sr");
        assert_eq!(whisper_language("xx"), "auto");
    }

    #[test]
    fn level_is_scaled_to_the_meter() {
        assert_eq!(level_of(&[]), 0.0);
        assert_eq!(level_of(&[0.0; 100]), 0.0);
        assert!(level_of(&[0.5; 100]) > 0.95);
        let quiet = level_of(&[0.01; 100]); // -40 дБ
        assert!(quiet > 0.3 && quiet < 0.5, "{quiet}");
    }
}

/// Живой прогон на настоящих моделях и записях: нужны файлы в
/// `BASTYON_ASR_DIR` (модели) и `BASTYON_ASR_WAV` (16 кГц моно WAV).
#[cfg(test)]
mod live_tests {
    use super::segmenter::Segmenter;
    use super::*;

    #[test]
    #[ignore]
    fn live_segments_and_transcribes_a_recording() {
        let dir = std::env::var("BASTYON_ASR_DIR").expect("BASTYON_ASR_DIR");
        let wav = std::env::var("BASTYON_ASR_WAV").expect("BASTYON_ASR_WAV");
        let model = std::env::var("BASTYON_ASR_MODEL").unwrap_or_else(|_| "small".into());
        let paths = AsrPaths::new(dir.into());
        let spec = model_spec(&model).unwrap();
        let (audio, rate) = capture::read_wav(&std::fs::read(wav).unwrap()).unwrap();
        let mut resampler = resample::Resampler::new(rate);
        let detector = engine::SileroDetector::load(&paths.file(&VAD_MODEL).to_string_lossy()).unwrap();
        let mut seg = Segmenter::new(detector);
        let mut phrases = Vec::new();
        for chunk in audio.chunks(rate as usize / 50) {
            phrases.extend(seg.push(&resampler.process(chunk)).unwrap());
        }
        phrases.extend(seg.finish().unwrap());
        let engine = engine::Engine::load(&paths.file(spec).to_string_lossy()).unwrap();
        let lang = std::env::var("BASTYON_ASR_LANG").unwrap_or_else(|_| "ru".into());
        let mut context = String::new();
        for p in &phrases {
            let t0 = Instant::now();
            let text = engine.transcribe(p, &lang, &context).unwrap();
            println!(
                "phrase {:.1}s → {:.2}s: {text}",
                p.len() as f32 / 16_000.0,
                t0.elapsed().as_secs_f32()
            );
            context.push(' ');
            context.push_str(&text);
        }
        assert!(!phrases.is_empty());
    }
}
