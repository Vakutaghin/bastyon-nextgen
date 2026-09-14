use crate::tor::state::{SharedTorState, TorPaths, TorStateSnapshot, TorStatus};
use std::process::{Child, Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter};

pub struct TorChild {
    pub child: Child,
}

impl TorChild {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
}

/// Spawn `tor -f <torrc>` and start a thread that parses stdout/stderr.
/// Updates shared state with bootstrap progress; emits `tor:state` on each change.
pub fn spawn(
    app: AppHandle,
    paths: &TorPaths,
    shared: SharedTorState,
) -> std::io::Result<TorChild> {
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

    // Run from the binary's directory so relative pluggable_transports paths resolve.
    if let Some(parent) = paths.binary.parent() {
        cmd.current_dir(parent);
    }

    let mut child = cmd.spawn()?;
    let pid = child.id();

    if let Some(out) = child.stdout.take() {
        let app_clone = app.clone();
        let shared_clone = shared.clone();
        thread::spawn(move || stream_log(out, app_clone, shared_clone, pid));
    }
    if let Some(err) = child.stderr.take() {
        let app_clone = app.clone();
        let shared_clone = shared.clone();
        thread::spawn(move || stream_log(err, app_clone, shared_clone, pid));
    }

    Ok(TorChild { child })
}

/// Сообщение статуса, когда процесс завершился сам (не через `tor_stop`).
pub const EXITED_MESSAGE: &str = "tor process exited unexpectedly";

fn stream_log<R: std::io::Read>(reader: R, app: AppHandle, shared: SharedTorState, pid: u32) {
    use std::io::{BufRead, BufReader};
    let buf = BufReader::new(reader);
    let mut recent_warns: Vec<String> = Vec::new();

    for line in buf.lines() {
        let Ok(line) = line else { continue };
        log::debug!("[tor] {}", line);

        let is_err = line.contains("[err]") || line.to_lowercase().contains("could not bind");
        let is_warn = line.contains("[warn]");

        if let Some(pct) = parse_bootstrap_pct(&line) {
            let snapshot = with_state(&shared, |state| {
                state.bootstrap_pct = pct;
                state.message = Some(line.clone());
                state.status = if pct >= 100 {
                    TorStatus::Ready
                } else {
                    TorStatus::Bootstrapping
                };
                state.snapshot()
            });
            if let Some(s) = snapshot {
                let _ = app.emit("tor:state", &s);
            }
            continue;
        }

        if is_err {
            // Bundle the last few warnings into the error message so the UI
            // shows the actual cause, not just `Reading config failed--see
            // warnings above`.
            let combined = if recent_warns.is_empty() {
                line.clone()
            } else {
                let warns = recent_warns.join("\n");
                format!("{}\n{}", warns, line)
            };
            let snapshot = with_state(&shared, |state| {
                state.status = TorStatus::Failed;
                state.message = Some(combined);
                state.snapshot()
            });
            if let Some(s) = snapshot {
                let _ = app.emit("tor:state", &s);
            }
            recent_warns.clear();
        } else if is_warn {
            recent_warns.push(line.clone());
            if recent_warns.len() > 5 {
                recent_warns.remove(0);
            }
            let snapshot = with_state(&shared, |state| {
                state.message = Some(line.clone());
                state.snapshot()
            });
            if let Some(s) = snapshot {
                let _ = app.emit("tor:state", &s);
            }
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

/// Переводит состояние в `Failed`, если умерший процесс — текущий и Tor
/// считался живым. Возвращает снапшот только при реальном переходе.
fn mark_exited(state: &mut crate::tor::state::TorState, pid: u32) -> Option<TorStateSnapshot> {
    let alive = matches!(
        state.status,
        TorStatus::Starting | TorStatus::Bootstrapping | TorStatus::Ready
    );
    if state.child_pid != Some(pid) || !alive {
        return None;
    }
    state.status = TorStatus::Failed;
    state.message = Some(EXITED_MESSAGE.into());
    state.child_pid = None;
    state.bootstrap_pct = 0;
    Some(state.snapshot())
}

/// Поток логов — обычный OS-поток без tokio-контекста, поэтому блокирующая
/// запись безопасна. Раньше при занятом локе обновление молча терялось.
fn with_state<R>(
    shared: &SharedTorState,
    mutate: impl FnOnce(&mut crate::tor::state::TorState) -> R,
) -> Option<R> {
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
    fn exit_of_current_process_marks_failed() {
        let mut st = crate::tor::state::TorState::default();
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
        let mut st = crate::tor::state::TorState::default();
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
}
