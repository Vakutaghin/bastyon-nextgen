use crate::tor::state::{SharedTorState, TorPaths, TorStatus};
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

    if let Some(out) = child.stdout.take() {
        let app_clone = app.clone();
        let shared_clone = shared.clone();
        thread::spawn(move || stream_log(out, app_clone, shared_clone));
    }
    if let Some(err) = child.stderr.take() {
        let app_clone = app.clone();
        let shared_clone = shared.clone();
        thread::spawn(move || stream_log(err, app_clone, shared_clone));
    }

    Ok(TorChild { child })
}

fn stream_log<R: std::io::Read>(reader: R, app: AppHandle, shared: SharedTorState) {
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
}

fn with_state<R>(
    shared: &SharedTorState,
    mutate: impl FnOnce(&mut crate::tor::state::TorState) -> R,
) -> Option<R> {
    if let Ok(mut state) = shared.try_write() {
        return Some(mutate(&mut state));
    }
    match tokio::runtime::Handle::try_current() {
        Ok(h) => Some(h.block_on(async {
            let mut state = shared.write().await;
            mutate(&mut state)
        })),
        Err(_) => None,
    }
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
}
