//! Запущенный модуль mesh-сетей: процесс, его stdin и stdout.
//!
//! Запрос — строка JSON в stdin, ответ находит свой запрос по номеру. События
//! соединений и узла приходят с номером стока, который приложение выдало
//! команде открытия, — и уходят в `Channel` окна, которое её вызвало. Модуль
//! упал — ждущие запросы получают ошибку, соединения радио — `closed`.
//! Остановка — закрыть stdin: модуль отпускает радио, сохраняет узел и
//! выходит; не успел — его снимают.
//!
//! Потоки, а не tokio: остановка нужна и в обработчике выхода, где рантайма нет.

use dashmap::DashMap;
use serde::Deserialize;
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::sync::oneshot;

/// Версия разговора с модулем (crates/bastyon-mesh/src/wire.rs). Модуль с
/// другой не запускаем: команды или их ответы могли поменяться.
pub const PROTOCOL: u32 = 1;

/// Сколько ждать первую строку модуля.
const HELLO_TIMEOUT: Duration = Duration::from_secs(10);
/// Сколько ждать, пока модуль сам выйдет после закрытия stdin.
const EXIT_GRACE: Duration = Duration::from_secs(4);

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SinkKind {
    Radio,
    Rns,
}

pub struct SinkEntry {
    kind: SinkKind,
    channel: Channel<Value>,
}

/// Стоки событий — общие для всех запусков модуля: номер выдаётся до запроса.
pub type Sinks = Arc<DashMap<u64, SinkEntry>>;

pub fn new_sinks() -> Sinks {
    Arc::new(DashMap::new())
}

pub fn add_sink(sinks: &Sinks, id: u64, kind: SinkKind, channel: Channel<Value>) {
    sinks.insert(id, SinkEntry { kind, channel });
}

#[derive(Deserialize)]
struct Hello {
    protocol: u32,
}

type Reply = Result<Value, String>;

pub struct Proc {
    child: Mutex<Child>,
    stdin: Mutex<Option<ChildStdin>>,
    pending: Arc<DashMap<u64, oneshot::Sender<Reply>>>,
    next_id: AtomicU64,
    alive: Arc<AtomicBool>,
}

/// Разобрать строку модуля и отдать её адресату.
fn route(line: &str, pending: &DashMap<u64, oneshot::Sender<Reply>>, sinks: &Sinks) {
    let Ok(msg) = serde_json::from_str::<Value>(line) else {
        log::warn!("[mesh] not json: {line}");
        return;
    };
    if let Some(id) = msg.get("id").and_then(Value::as_u64) {
        let reply = match msg.get("err") {
            Some(err) => Err(err.as_str().unwrap_or("mesh_module_failed").to_string()),
            None => Ok(msg.get("ok").cloned().unwrap_or(Value::Null)),
        };
        if let Some((_, tx)) = pending.remove(&id) {
            let _ = tx.send(reply);
        }
        return;
    }
    if let Some(sink) = msg.get("sink").and_then(Value::as_u64) {
        if msg.get("end").is_some() {
            sinks.remove(&sink);
        } else if let Some(ev) = msg.get("ev") {
            if let Some(entry) = sinks.get(&sink) {
                let _ = entry.channel.send(ev.clone());
            }
        }
    }
}

/// Модуля больше нет: ждущим — ошибка, соединениям радио — «пропало».
fn on_exit(pending: &DashMap<u64, oneshot::Sender<Reply>>, sinks: &Sinks) {
    let ids: Vec<u64> = pending.iter().map(|e| *e.key()).collect();
    for id in ids {
        if let Some((_, tx)) = pending.remove(&id) {
            let _ = tx.send(Err("mesh_module_stopped".into()));
        }
    }
    let radio: Vec<u64> = sinks
        .iter()
        .filter(|e| e.value().kind == SinkKind::Radio)
        .map(|e| *e.key())
        .collect();
    for id in radio {
        if let Some((_, entry)) = sinks.remove(&id) {
            let _ = entry.channel.send(serde_json::json!({
                "kind": "closed",
                "reason": "device_lost: mesh module stopped",
            }));
        }
    }
    sinks.clear();
}

impl Proc {
    /// Запустить модуль и дождаться его приветствия.
    pub async fn spawn(binary: &Path, sinks: Sinks) -> Result<Arc<Proc>, String> {
        let mut cmd = Command::new(binary);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW — не мигать консолью.
            cmd.creation_flags(0x08000000);
        }
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("mesh_module_failed: {e}"))?;
        let stdout = child.stdout.take().expect("piped");
        let stderr = child.stderr.take().expect("piped");
        let stdin = child.stdin.take();

        let pending: Arc<DashMap<u64, oneshot::Sender<Reply>>> = Arc::new(DashMap::new());
        let alive = Arc::new(AtomicBool::new(true));
        let (hello_tx, hello_rx) = oneshot::channel::<Option<Hello>>();

        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                log::info!("[mesh] {line}");
            }
        });

        {
            let pending = pending.clone();
            let alive = alive.clone();
            std::thread::spawn(move || {
                let mut lines = BufReader::new(stdout).lines().map_while(Result::ok);
                let hello = lines
                    .next()
                    .and_then(|line| serde_json::from_str::<Value>(&line).ok())
                    .and_then(|v| serde_json::from_value::<Hello>(v.get("hello")?.clone()).ok());
                let _ = hello_tx.send(hello);
                for line in lines {
                    route(&line, &pending, &sinks);
                }
                alive.store(false, Ordering::SeqCst);
                on_exit(&pending, &sinks);
            });
        }

        let proc = Arc::new(Proc {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            pending,
            next_id: AtomicU64::new(1),
            alive,
        });
        let hello = tokio::time::timeout(HELLO_TIMEOUT, hello_rx).await;
        match hello {
            Ok(Ok(Some(h))) if h.protocol == PROTOCOL => Ok(proc),
            Ok(Ok(Some(h))) => {
                proc.kill();
                Err(format!("mesh_module_outdated: protocol {}", h.protocol))
            }
            _ => {
                proc.kill();
                Err("mesh_module_failed: no answer".into())
            }
        }
    }

    pub fn alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }

    /// Команда модулю; ответ — когда он придёт (или модуль упадёт).
    pub async fn request(&self, cmd: &str, args: Value) -> Reply {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.insert(id, tx);
        let mut line = serde_json::json!({ "id": id, "cmd": cmd, "args": args }).to_string();
        line.push('\n');
        let written = {
            let mut stdin = self.stdin.lock().unwrap_or_else(|p| p.into_inner());
            match stdin.as_mut() {
                Some(pipe) => pipe.write_all(line.as_bytes()).and_then(|_| pipe.flush()),
                None => Err(std::io::ErrorKind::BrokenPipe.into()),
            }
        };
        if written.is_err() || !self.alive() {
            self.pending.remove(&id);
            return Err("mesh_module_stopped".into());
        }
        rx.await
            .unwrap_or_else(|_| Err("mesh_module_stopped".into()))
    }

    fn kill(&self) {
        let mut child = self.child.lock().unwrap_or_else(|p| p.into_inner());
        let _ = child.kill();
        let _ = child.wait();
    }

    /// Остановить: закрыть stdin и дать модулю выйти самому (радио, узел),
    /// не успел — снять. Синхронно: зовётся и при выходе из приложения.
    pub fn stop(&self) {
        drop(self.stdin.lock().unwrap_or_else(|p| p.into_inner()).take());
        let deadline = Instant::now() + EXIT_GRACE;
        loop {
            let done = {
                let mut child = self.child.lock().unwrap_or_else(|p| p.into_inner());
                matches!(child.try_wait(), Ok(Some(_)) | Err(_))
            };
            if done {
                return;
            }
            if Instant::now() >= deadline {
                self.kill();
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replies_find_their_requests() {
        let pending = DashMap::new();
        let sinks = new_sinks();
        let (tx1, mut rx1) = oneshot::channel();
        let (tx2, mut rx2) = oneshot::channel();
        pending.insert(1, tx1);
        pending.insert(2, tx2);
        route(r#"{"id":2,"err":"link_not_found: 5"}"#, &pending, &sinks);
        route(r#"{"id":1,"ok":{"running":false}}"#, &pending, &sinks);
        route(r#"{"id":9,"ok":null}"#, &pending, &sinks);
        route("not json", &pending, &sinks);
        assert_eq!(
            rx1.try_recv().unwrap(),
            Ok(serde_json::json!({ "running": false }))
        );
        assert_eq!(
            rx2.try_recv().unwrap(),
            Err("link_not_found: 5".to_string())
        );
        assert!(pending.is_empty());
    }

    #[test]
    fn exit_fails_waiting_requests() {
        let pending = DashMap::new();
        let sinks = new_sinks();
        let (tx, mut rx) = oneshot::channel();
        pending.insert(1, tx);
        on_exit(&pending, &sinks);
        assert_eq!(
            rx.try_recv().unwrap(),
            Err("mesh_module_stopped".to_string())
        );
    }

    /// Настоящий модуль: `cargo build -p bastyon-mesh`, затем
    /// `cargo test --lib mesh::host -- --ignored`.
    #[test]
    #[ignore]
    fn live_module_answers_and_stops() {
        let exe = std::env::current_exe().unwrap();
        let dir = exe.parent().unwrap().parent().unwrap();
        let binary = dir.join(if cfg!(windows) {
            "bastyon-mesh.exe"
        } else {
            "bastyon-mesh"
        });
        assert!(binary.is_file(), "{} — соберите модуль", binary.display());
        tauri::async_runtime::block_on(async {
            let proc = Proc::spawn(&binary, new_sinks()).await.expect("spawn");
            let status = proc.request("rns_status", Value::Null).await.unwrap();
            assert_eq!(status["running"], false);
            let err = proc
                .request("radio_write", serde_json::json!({ "link": 5, "data": [1] }))
                .await
                .unwrap_err();
            assert!(err.starts_with("link_not_found"), "{err}");
            let started = Instant::now();
            proc.stop();
            assert!(started.elapsed() < EXIT_GRACE, "вышел сам, без kill");
            assert!(proc.request("rns_status", Value::Null).await.is_err());
        });
    }
}
