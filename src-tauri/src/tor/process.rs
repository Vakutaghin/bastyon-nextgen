use crate::tor::state::{SharedTorState, TorPaths, TorState, TorStateSnapshot, TorStatus};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

pub struct TorChild {
    pub child: Child,
}

impl TorChild {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    /// Пайпы логов — чтобы запустить потоки уже после того, как `child_pid`
    /// записан в состояние и процесс сохранён в менеджере.
    pub fn take_logs(&mut self) -> TorLogs {
        TorLogs {
            pid: self.pid(),
            stdout: self.child.stdout.take(),
            stderr: self.child.stderr.take(),
        }
    }
}

pub struct TorLogs {
    pid: u32,
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
}

impl TorLogs {
    /// Потоки разбирают stdout/stderr: прогресс бутстрапа, ошибки, падения
    /// транспорта. Каждое изменение — событие `tor:state`.
    pub fn start<RT: Runtime>(self, app: AppHandle<RT>, shared: SharedTorState) {
        let pid = self.pid;
        if let Some(out) = self.stdout {
            let (app, shared) = (app.clone(), shared.clone());
            thread::spawn(move || stream_log(out, app, shared, pid));
        }
        if let Some(err) = self.stderr {
            thread::spawn(move || stream_log(err, app, shared, pid));
        }
    }
}

/// Spawn `tor -f <torrc>` with piped output; logging starts via [`TorChild::take_logs`].
pub fn spawn(paths: &TorPaths) -> std::io::Result<TorChild> {
    let mut cmd = Command::new(&paths.binary);
    cmd.arg("-f").arg(&paths.torrc);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }

    // Рабочий каталог — каталог tor: пути транспортов в torrc относительные
    // (pt_config::PT_DIR_REL).
    if let Some(parent) = paths.binary.parent() {
        cmd.current_dir(parent);
        #[cfg(target_os = "linux")]
        cmd.env("LD_LIBRARY_PATH", library_path(parent));
    }

    Ok(TorChild { child: cmd.spawn()? })
}

/// У tor из бандла для Linux нет RPATH: libevent, libssl и libcrypto лежат
/// рядом с ним, и без этой переменной tor не запускался там, где своего
/// libevent-2.1 нет (так запускает его и Tor Browser).
#[cfg(any(target_os = "linux", test))]
fn library_path(tor_dir: &std::path::Path) -> std::ffi::OsString {
    let mut value = tor_dir.as_os_str().to_owned();
    if let Some(inherited) = std::env::var_os("LD_LIBRARY_PATH").filter(|v| !v.is_empty()) {
        value.push(":");
        value.push(inherited);
    }
    value
}

/// Сообщение статуса, когда процесс завершился сам (не через `tor_stop`).
pub const EXITED_MESSAGE: &str = "tor process exited unexpectedly";

fn stream_log<R: std::io::Read, RT: Runtime>(
    reader: R,
    app: AppHandle<RT>,
    shared: SharedTorState,
    pid: u32,
) {
    use std::io::{BufRead, BufReader};
    let buf = BufReader::new(reader);
    let mut recent_warns: Vec<String> = Vec::new();

    for line in buf.lines() {
        let Ok(line) = line else { continue };
        log::debug!("[tor] {}", line);
        let snapshot = with_state(&shared, |state| {
            apply_log_line(state, pid, &line, &mut recent_warns)
        });
        if let Some(Some(s)) = snapshot {
            let _ = app.emit("tor:state", &s);
        }
    }

    // EOF = процесс умер (или закрыл pipe). Тихая смерть раньше оставляла
    // `Ready`, и JS продолжал слать через мёртвый SOCKS (S59). `tor_stop`
    // обнуляет `child_pid` до kill, поэтому штатную остановку не трогаем.
    let snapshot = with_state(&shared, |state| mark_exited(state, pid));
    if let Some(Some(s)) = snapshot {
        let _ = app.emit("tor:state", &s);
    }
}

/// Строка лога → изменение состояния. Строки не текущего процесса (убитая
/// попытка автоподбора допечатывает своё) состояние не трогают.
fn apply_log_line(
    state: &mut TorState,
    pid: u32,
    line: &str,
    recent_warns: &mut Vec<String>,
) -> Option<TorStateSnapshot> {
    if state.child_pid != Some(pid) {
        return None;
    }
    let body = log_body(line);

    if let Some(pct) = parse_bootstrap_pct(line) {
        state.bootstrap_pct = pct;
        state.message = Some(body.to_string());
        if pct >= 100 {
            state.status = TorStatus::Ready;
            state.stalled = false;
            // Подключились: дальше смерть процесса — `Failed`, а не «следующая
            // попытка» при статусе `Ready` и мёртвом SOCKS.
            state.keep_going = false;
        } else {
            state.status = TorStatus::Bootstrapping;
        }
        return Some(state.snapshot());
    }

    let is_err = line.contains("[err]") || line.to_lowercase().contains("could not bind");
    if is_err {
        // Bundle the last few warnings into the error message so the UI
        // shows the actual cause, not just `Reading config failed--see
        // warnings above`.
        let mut parts = std::mem::take(recent_warns);
        parts.push(body.to_string());
        fail_attempt(state, parts.join("\n"));
        return Some(state.snapshot());
    }

    if is_pt_failure(line) {
        state.pt_failures += 1;
    }
    if line.contains("[warn]") {
        recent_warns.push(body.to_string());
        if recent_warns.len() > 5 {
            recent_warns.remove(0);
        }
        state.message = Some(body.to_string());
        return Some(state.snapshot());
    }
    None
}

/// Попытка не удалась. В автоподборе это сигнал перейти к следующей: статус
/// не меняется, чтобы запросы ждали, а не падали. Иначе — `Failed`.
fn fail_attempt(state: &mut TorState, message: String) {
    state.message = Some(message);
    if state.keep_going {
        state.candidate_failed = true;
    } else {
        state.status = TorStatus::Failed;
    }
}

/// Транспорт не запустился или упал: Tor перезапускает его каждую секунду,
/// и без счётчика попытка висела бы до таймаута.
fn is_pt_failure(line: &str) -> bool {
    line.contains("Managed proxy")
        && (line.contains("terminated with status code")
            || line.contains("failed at launch")
            || line.contains("died in state"))
}

/// Текст после `[notice] `/`[warn] ` — без даты и уровня.
fn log_body(line: &str) -> &str {
    for level in ["[notice] ", "[warn] ", "[err] ", "[info] "] {
        if let Some(idx) = line.find(level) {
            return &line[idx + level.len()..];
        }
    }
    line
}

/// Переводит состояние в `Failed`, если умерший процесс — текущий и Tor
/// считался живым. Возвращает снапшот только при реальном переходе.
fn mark_exited(state: &mut TorState, pid: u32) -> Option<TorStateSnapshot> {
    let alive = matches!(
        state.status,
        TorStatus::Starting | TorStatus::Bootstrapping | TorStatus::Ready
    );
    if state.child_pid != Some(pid) || !alive {
        return None;
    }
    state.child_pid = None;
    state.bootstrap_pct = 0;
    fail_attempt(state, EXITED_MESSAGE.into());
    Some(state.snapshot())
}

/// Поток логов — обычный OS-поток без tokio-контекста, поэтому блокирующая
/// запись безопасна. Раньше при занятом локе обновление молча терялось.
fn with_state<R>(shared: &SharedTorState, mutate: impl FnOnce(&mut TorState) -> R) -> Option<R> {
    let mut state = shared.blocking_write();
    Some(mutate(&mut state))
}

/// Parse "Bootstrapped 75% (...)" -> 75
fn parse_bootstrap_pct(line: &str) -> Option<u8> {
    let idx = line.find("Bootstrapped ")?;
    let after = &line[idx + "Bootstrapped ".len()..];
    let pct_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    pct_str.parse().ok()
}

pub fn kill(child: &mut TorChild) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        // SIGTERM first, give it ~2s, then SIGKILL.
        unsafe { libc_kill(child.child.id() as i32, 15) };
        for _ in 0..20 {
            match child.child.try_wait()? {
                Some(_) => return Ok(()),
                None => std::thread::sleep(std::time::Duration::from_millis(100)),
            }
        }
        let _ = child.child.kill();
        Ok(())
    }
    #[cfg(windows)]
    {
        // taskkill /PID xxx /F /T also kills PT child processes (lyrebird/snowflake).
        let pid = child.child.id();
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F", "/T"])
            .output();
        let _ = child.child.wait();
        Ok(())
    }
}

#[cfg(unix)]
unsafe fn libc_kill(pid: i32, sig: i32) -> i32 {
    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }
    kill(pid, sig)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bootstrap_percent() {
        assert_eq!(
            parse_bootstrap_pct(
                "Apr 26 12:00:00.000 [notice] Bootstrapped 75% (enough_dirinfo): Loaded enough"
            ),
            Some(75)
        );
        assert_eq!(parse_bootstrap_pct("nothing here"), None);
        assert_eq!(parse_bootstrap_pct("Bootstrapped 100% (done): Done"), Some(100));
    }

    #[test]
    fn bundled_libraries_come_first_on_linux() {
        let dir = std::path::Path::new("/home/u/.local/share/app/tor/tor");
        let value = library_path(dir).into_string().unwrap();
        let ours = dir.to_str().unwrap();
        assert!(
            value == ours || value.starts_with(&format!("{ours}:")),
            "{value}"
        );
    }

    #[test]
    fn exit_of_current_process_marks_failed() {
        let mut st = TorState::default();
        st.status = TorStatus::Ready;
        st.child_pid = Some(42);
        let snap = mark_exited(&mut st, 42).expect("transition");
        assert_eq!(snap.status, TorStatus::Failed);
        assert_eq!(st.message.as_deref(), Some(EXITED_MESSAGE));
        assert_eq!(st.child_pid, None);
    }

    #[test]
    fn exit_after_tor_stop_or_of_stale_process_is_ignored() {
        // tor_stop: Off + child_pid=None до kill.
        let mut st = TorState::default();
        assert!(mark_exited(&mut st, 42).is_none());
        assert_eq!(st.status, TorStatus::Off);

        // Старый процесс умер после того, как запущен новый (другой pid).
        st.status = TorStatus::Bootstrapping;
        st.child_pid = Some(43);
        assert!(mark_exited(&mut st, 42).is_none());
        assert_eq!(st.status, TorStatus::Bootstrapping);

        // Failed по `[err]` уже выставлен — сообщение с причиной не затираем.
        st.status = TorStatus::Failed;
        st.message = Some("could not bind".into());
        st.child_pid = Some(42);
        assert!(mark_exited(&mut st, 42).is_none());
        assert_eq!(st.message.as_deref(), Some("could not bind"));
    }

    fn bootstrapping(pid: u32) -> TorState {
        TorState {
            status: TorStatus::Bootstrapping,
            child_pid: Some(pid),
            ..TorState::default()
        }
    }

    #[test]
    fn lines_of_a_killed_attempt_do_not_touch_the_state() {
        let mut st = bootstrapping(43);
        let mut warns = Vec::new();
        let line = "Oct 17 16:17:07.000 [notice] Bootstrapped 100% (done): Done";
        assert!(apply_log_line(&mut st, 42, line, &mut warns).is_none());
        assert_eq!(st.status, TorStatus::Bootstrapping);
        assert!(apply_log_line(&mut st, 43, line, &mut warns).is_some());
        assert_eq!(st.status, TorStatus::Ready);
        assert_eq!(st.message.as_deref(), Some("Bootstrapped 100% (done): Done"));
    }

    #[test]
    fn in_auto_mode_an_error_moves_on_instead_of_failing() {
        let mut st = bootstrapping(7);
        st.keep_going = true;
        let mut warns = Vec::new();
        apply_log_line(&mut st, 7, "Oct 17 [warn] Problem bootstrapping. Stuck at 10%", &mut warns);
        apply_log_line(&mut st, 7, "Oct 17 [err] Reading config failed", &mut warns);
        assert_eq!(st.status, TorStatus::Bootstrapping, "requests keep waiting");
        assert!(st.candidate_failed);
        assert_eq!(
            st.message.as_deref(),
            Some("Problem bootstrapping. Stuck at 10%\nReading config failed")
        );

        // Подключились — дальше смерть процесса уже `Failed`.
        let mut st = bootstrapping(8);
        st.keep_going = true;
        apply_log_line(&mut st, 8, "[notice] Bootstrapped 100% (done): Done", &mut warns);
        assert!(!st.keep_going);
        mark_exited(&mut st, 8).expect("transition");
        assert_eq!(st.status, TorStatus::Failed);
    }

    #[test]
    fn transport_crashes_are_counted() {
        let mut st = bootstrapping(9);
        let mut warns = Vec::new();
        for line in [
            "[warn] Managed proxy \"pluggable_transports/lyrebird\" having PID 1 terminated with status code 1",
            "[warn] Managed proxy at 'pluggable_transports/lyrebird' died in state Launched",
            "[warn] Proxy Client: unable to connect OR connection",
        ] {
            apply_log_line(&mut st, 9, line, &mut warns);
        }
        assert_eq!(st.pt_failures, 2);
        assert_eq!(st.message.as_deref(), Some("Proxy Client: unable to connect OR connection"));
    }
}
