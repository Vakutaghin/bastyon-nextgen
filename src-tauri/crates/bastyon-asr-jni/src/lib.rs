//! JNI для голосового ввода на Android: класс
//! `com.bastyon.app.plugins.voice.AsrNative`.
//!
//! Движок (whisper.cpp) и нарезка речи на фразы — те же файлы, что у
//! компьютера (src/asr/engine.rs, segmenter.rs), подключённые модулями.
//! Рабочие потоки повторяют src/asr/mod.rs: модель грузится, пока человек
//! начинает говорить, фразы распознаются по очереди, пока он говорит
//! следующие, и после «стоп» остаётся дождаться только последней.
//!
//! Звук пишет Java (AudioRecord, 16 кГц, моно) и отдаёт кусками в `push`;
//! громкость она тоже считает сама, а `speaking()` говорит, слышит ли детектор
//! речь. События сессии — JSON в `AsrNative.Events.onEvent` с теми же полями,
//! что события `asr:*` у компьютера, и полем `event`: state, text, end.

#[allow(dead_code)]
#[path = "../../../src/asr/engine.rs"]
mod engine;
#[allow(dead_code)]
#[path = "../../../src/asr/segmenter.rs"]
mod segmenter;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex, MutexGuard};
use std::time::Duration;

use jni::objects::{GlobalRef, JClass, JFloatArray, JObject, JString, JValue};
use jni::sys::{jboolean, jint, JNI_FALSE, JNI_TRUE};
use jni::{JNIEnv, JavaVM};
use serde_json::json;

/// Модель выгружается из памяти после такого простоя.
const ENGINE_IDLE: Duration = Duration::from_secs(5 * 60);

// ---------------------------------------------------------------------------
// Поток распознавания: владеет моделью, берёт фразы по очереди.
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

static ENGINE: Mutex<Option<mpsc::Sender<EngineJob>>> = Mutex::new(None);

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

fn send_engine(job: EngineJob) {
    let mut guard = lock(&ENGINE);
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

fn ensure_engine(engine: &mut Option<engine::Engine>, file: &str) -> Result<(), String> {
    if engine
        .as_ref()
        .map(|e| e.model_file() != file)
        .unwrap_or(true)
    {
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
            // Простой: освобождаем память — на телефоне её мало.
            Err(mpsc::RecvTimeoutError::Timeout) => engine = None,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

// ---------------------------------------------------------------------------
// Сессия диктовки
// ---------------------------------------------------------------------------

enum Msg {
    Audio(Vec<f32>),
    Stop,
    Cancel,
}

struct Control {
    id: u32,
    tx: mpsc::Sender<Msg>,
}

static SESSION: Mutex<Option<Control>> = Mutex::new(None);
static NEXT_SESSION: AtomicU32 = AtomicU32::new(1);
/// Детектор слышит речь — для индикатора на кнопке.
static SPEAKING: AtomicBool = AtomicBool::new(false);

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

/// Куда уходят события сессии: в Java или, в тестах, в канал.
type Emit = Box<dyn Fn(serde_json::Value) + Send>;

struct Sink {
    emit: Emit,
    session: u32,
}

impl Sink {
    fn emit(&self, mut payload: serde_json::Value) {
        payload["session"] = json!(self.session);
        (self.emit)(payload);
    }

    fn state(&self, loading: bool, pending: usize) {
        self.emit(json!({ "event": "state", "loading": loading, "pending": pending }));
    }
}

type Pending = VecDeque<(u32, mpsc::Receiver<Result<String, String>>)>;

struct Session {
    sink: Sink,
    model_file: String,
    vad_file: String,
    language: String,
    /// Текст перед курсором и уже распознанное — подсказка модели.
    context: String,
    cancelled: Arc<AtomicBool>,
    pending: Pending,
    seq: u32,
}

impl Session {
    fn run(mut self, rx: mpsc::Receiver<Msg>) {
        let result = self.listen(rx);
        SPEAKING.store(false, Ordering::Relaxed);
        let (reason, error) = match result {
            Ok(reason) => (reason, None),
            Err(e) => {
                self.cancelled.store(true, Ordering::Relaxed);
                log::warn!("asr session {}: {e}", self.sink.session);
                ("error", Some(e))
            }
        };
        {
            let mut slot = lock(&SESSION);
            if slot
                .as_ref()
                .map(|s| s.id == self.sink.session)
                .unwrap_or(false)
            {
                *slot = None;
            }
        }
        self.sink
            .emit(json!({ "event": "end", "reason": reason, "error": error }));
    }

    fn listen(&mut self, rx: mpsc::Receiver<Msg>) -> Result<&'static str, String> {
        // Модель грузится, пока человек начинает говорить.
        let (warm_tx, warm_rx) = mpsc::channel();
        send_engine(EngineJob::Warmup {
            model_file: self.model_file.clone(),
            done: warm_tx,
        });
        let mut loading = true;
        self.sink.state(true, 0);

        let detector = engine::SileroDetector::load(&self.vad_file)?;
        let mut segmenter = segmenter::Segmenter::new(detector);

        let outcome = loop {
            match rx.recv_timeout(Duration::from_millis(40)) {
                Ok(Msg::Audio(samples)) => {
                    for utterance in segmenter.push(&samples)? {
                        self.submit(utterance, loading);
                    }
                    SPEAKING.store(segmenter.speaking(), Ordering::Relaxed);
                }
                Ok(Msg::Stop) => break "stopped",
                Ok(Msg::Cancel) | Err(mpsc::RecvTimeoutError::Disconnected) => break "cancelled",
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
            if loading {
                match warm_rx.try_recv() {
                    Ok(Ok(())) => {
                        loading = false;
                        self.sink.state(false, self.pending.len());
                    }
                    Ok(Err(e)) => return Err(e),
                    Err(_) => {}
                }
            }
            self.collect(false, loading)?;
        };
        SPEAKING.store(false, Ordering::Relaxed);

        if outcome == "cancelled" {
            self.cancelled.store(true, Ordering::Relaxed);
            return Ok(outcome);
        }
        // Хвост: последняя фраза — без паузы после неё.
        if let Some(tail) = segmenter.finish()? {
            self.submit(tail, loading);
        }
        if loading {
            match warm_rx.recv() {
                Ok(Err(e)) => return Err(e),
                _ => self.sink.state(false, self.pending.len()),
            }
        }
        self.collect(true, false)?;
        Ok(outcome)
    }

    fn submit(&mut self, samples: Vec<f32>, loading: bool) {
        let (reply, rx) = mpsc::channel();
        send_engine(EngineJob::Transcribe {
            model_file: self.model_file.clone(),
            samples,
            language: self.language.clone(),
            prompt: self.context.clone(),
            cancelled: self.cancelled.clone(),
            reply,
        });
        self.pending.push_back((self.seq, rx));
        self.seq += 1;
        self.sink.state(loading, self.pending.len());
    }

    /// Отдать готовые фразы по порядку; `wait` — дождаться всех.
    fn collect(&mut self, wait: bool, loading: bool) -> Result<(), String> {
        let before = self.pending.len();
        while let Some((seq, rx)) = self.pending.front() {
            let result = if wait {
                rx.recv()
                    .map_err(|_| "engine_error: worker stopped".to_string())?
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
            self.pending.pop_front();
            let text = result?;
            if !text.is_empty() {
                self.context.push(' ');
                self.context.push_str(&text);
                self.sink
                    .emit(json!({ "event": "text", "seq": seq, "text": text }));
            }
        }
        if self.pending.len() != before {
            self.sink.state(loading, self.pending.len());
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// JNI
// ---------------------------------------------------------------------------

fn init_logging() {
    #[cfg(target_os = "android")]
    android_logger::init_once(
        android_logger::Config::default()
            .with_max_level(log::LevelFilter::Info)
            .with_tag("bastyon-asr"),
    );
}

fn text(env: &mut JNIEnv, s: &JString) -> Result<String, String> {
    if s.is_null() {
        return Ok(String::new());
    }
    env.get_string(s)
        .map(Into::into)
        .map_err(|e| format!("engine_error: {e}"))
}

fn throw(env: &mut JNIEnv, error: &str) {
    let _ = env.throw_new("java/lang/RuntimeException", error);
}

fn send_session(session: u32, msg: Msg) {
    let slot = lock(&SESSION);
    if let Some(s) = slot.as_ref().filter(|s| s.id == session) {
        let _ = s.tx.send(msg);
    }
}

/// Процессор подходит для распознавания.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_supported(
    _env: JNIEnv,
    _class: JClass,
) -> jboolean {
    if engine::cpu_supported() {
        JNI_TRUE
    } else {
        JNI_FALSE
    }
}

/// Начать диктовку; прежняя сессия отменяется. Возвращает id сессии.
fn start_session(
    model_file: String,
    vad_file: String,
    language: &str,
    prompt: String,
    emit: Emit,
) -> Result<u32, String> {
    let id = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    {
        let mut slot = lock(&SESSION);
        if let Some(prev) = slot.take() {
            let _ = prev.tx.send(Msg::Cancel);
        }
        *slot = Some(Control { id, tx });
    }
    let session = Session {
        sink: Sink { emit, session: id },
        model_file,
        vad_file,
        language: whisper_language(language),
        context: prompt,
        cancelled: Arc::new(AtomicBool::new(false)),
        pending: VecDeque::new(),
        seq: 0,
    };
    std::thread::Builder::new()
        .name("asr-session".into())
        .spawn(move || session.run(rx))
        .map_err(|e| format!("engine_error: {e}"))?;
    Ok(id)
}

/// Событие — в `Events.onEvent(String)`. Поток сессии подключается к JVM
/// один раз (daemon), а не на каждое событие.
fn java_event(vm: &JavaVM, events: &GlobalRef, payload: serde_json::Value) {
    let Ok(mut env) = vm.attach_current_thread_as_daemon() else {
        return;
    };
    let Ok(text) = env.new_string(payload.to_string()) else {
        return;
    };
    let _ = env.call_method(
        events.as_obj(),
        "onEvent",
        "(Ljava/lang/String;)V",
        &[JValue::Object(&JObject::from(text))],
    );
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }
}

#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_start(
    mut env: JNIEnv,
    _class: JClass,
    model_file: JString,
    vad_file: JString,
    language: JString,
    prompt: JString,
    events: JObject,
) -> jint {
    init_logging();
    let started = (|| -> Result<jint, String> {
        let model_file = text(&mut env, &model_file)?;
        let vad_file = text(&mut env, &vad_file)?;
        let language = text(&mut env, &language)?;
        let prompt = text(&mut env, &prompt)?;
        let vm = env
            .get_java_vm()
            .map_err(|e| format!("engine_error: {e}"))?;
        let events = env
            .new_global_ref(events)
            .map_err(|e| format!("engine_error: {e}"))?;
        let emit: Emit = Box::new(move |payload| java_event(&vm, &events, payload));
        let id = start_session(model_file, vad_file, &language, prompt, emit)?;
        Ok(id as jint)
    })();
    match started {
        Ok(id) => id,
        Err(e) => {
            throw(&mut env, &e);
            0
        }
    }
}

/// Кусок записи: 16 кГц, моно, -1..1.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_push(
    env: JNIEnv,
    _class: JClass,
    session: jint,
    samples: JFloatArray,
) {
    let Ok(len) = env.get_array_length(&samples) else {
        return;
    };
    let mut buf = vec![0f32; len as usize];
    if env.get_float_array_region(&samples, 0, &mut buf).is_err() {
        return;
    }
    send_session(session as u32, Msg::Audio(buf));
}

/// Закончить: дораспознать сказанное.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_stop(
    _env: JNIEnv,
    _class: JClass,
    session: jint,
) {
    send_session(session as u32, Msg::Stop);
}

/// Прервать без распознавания хвоста.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_cancel(
    _env: JNIEnv,
    _class: JClass,
    session: jint,
) {
    send_session(session as u32, Msg::Cancel);
}

/// Слышит ли детектор речь прямо сейчас.
#[no_mangle]
pub extern "system" fn Java_com_bastyon_app_plugins_voice_AsrNative_speaking(
    _env: JNIEnv,
    _class: JClass,
) -> jboolean {
    if SPEAKING.load(Ordering::Relaxed) {
        JNI_TRUE
    } else {
        JNI_FALSE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn languages_map_to_whisper_codes() {
        assert_eq!(whisper_language("ru"), "ru");
        assert_eq!(whisper_language("kr"), "ko");
        assert_eq!(whisper_language("xx"), "auto");
    }

    /// Сессия целиком, как её ведёт телефон: куски по 100 мс, «стоп», текст
    /// и конец. Нужны модели в `BASTYON_ASR_DIR` (ggml-base-q5_1.bin и
    /// ggml-silero-v6.2.0.bin) и запись `BASTYON_ASR_WAV` (16 кГц, моно, 16 бит).
    #[test]
    #[ignore]
    fn live_session_transcribes_a_recording() {
        let dir =
            std::path::PathBuf::from(std::env::var("BASTYON_ASR_DIR").expect("BASTYON_ASR_DIR"));
        let wav =
            std::fs::read(std::env::var("BASTYON_ASR_WAV").expect("BASTYON_ASR_WAV")).unwrap();
        let data = wav
            .windows(4)
            .position(|w| w == b"data")
            .expect("data chunk")
            + 8;
        let samples: Vec<f32> = wav[data..]
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0)
            .collect();

        let (tx, rx) = mpsc::channel::<serde_json::Value>();
        let tx = Mutex::new(tx);
        let id = start_session(
            dir.join("ggml-base-q5_1.bin").to_string_lossy().into(),
            dir.join("ggml-silero-v6.2.0.bin").to_string_lossy().into(),
            &std::env::var("BASTYON_ASR_LANG").unwrap_or_else(|_| "ru".into()),
            String::new(),
            Box::new(move |ev| {
                let _ = lock(&tx).send(ev);
            }),
        )
        .unwrap();
        for chunk in samples.chunks(1600) {
            send_session(id, Msg::Audio(chunk.to_vec()));
        }
        send_session(id, Msg::Stop);

        let mut texts = Vec::new();
        let end = loop {
            let ev = rx
                .recv_timeout(Duration::from_secs(120))
                .expect("session timed out");
            assert_eq!(ev["session"], json!(id));
            match ev["event"].as_str() {
                Some("text") => texts.push(ev["text"].as_str().unwrap().to_string()),
                Some("end") => break ev,
                _ => {}
            }
        };
        println!("texts: {texts:?}");
        assert_eq!(end["reason"], json!("stopped"), "{end}");
        assert!(!texts.join(" ").trim().is_empty());
        assert!(lock(&SESSION).is_none(), "session slot is freed");
    }
}
