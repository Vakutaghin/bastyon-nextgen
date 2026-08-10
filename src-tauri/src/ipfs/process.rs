use crate::ipfs::state::{IpfsPaths, SharedIpfsState};
use std::process::{Child, Command, Stdio};
use std::thread;
use tauri::AppHandle;

pub struct IpfsChild {
    pub child: Child,
}

impl IpfsChild {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
}

/// Запускает `ipfs daemon` с IPFS_PATH на наш repo. Логи стримятся в фоне;
/// сообщение о занятой блокировке кладётся в state для понятной диагностики.
/// Готовность демона определяет вызывающий — опросом API (см. mod::wait_ready),
/// а не парсингом stdout: формат строк меняется между версиями Kubo.
pub fn spawn_daemon(
    app: AppHandle,
    paths: &IpfsPaths,
    shared: SharedIpfsState,
) -> std::io::Result<IpfsChild> {
    let mut cmd = Command::new(&paths.binary);
    cmd.arg("daemon").arg("--migrate=true");
    cmd.env("IPFS_PATH", &paths.repo);
    // Не отчитываться наружу о том, что читает пользователь.
    cmd.env("IPFS_TELEMETRY", "off");
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW — не мигать консолью.
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn()?;

    if let Some(out) = child.stdout.take() {
        let (a, s) = (app.clone(), shared.clone());
        thread::spawn(move || stream_log(out, a, s));
    }
    if let Some(err) = child.stderr.take() {
        let (a, s) = (app.clone(), shared.clone());
        thread::spawn(move || stream_log(err, a, s));
    }

    Ok(IpfsChild { child })
}

fn stream_log<R: std::io::Read>(reader: R, app: AppHandle, shared: SharedIpfsState) {
    use std::io::{BufRead, BufReader};
    let buf = BufReader::new(reader);
    for line in buf.lines() {
        let Ok(line) = line else { continue };
        log::debug!("[ipfs] {}", line);

        if is_lock_error(&line) {
            let snapshot = with_state(&shared, |state| {
                state.message = Some(
                    "IPFS repo is locked by another process (orphaned daemon?)".to_string(),
                );
                state.snapshot()
            });
            if let Some(s) = snapshot {
                use tauri::Emitter;
                let _ = app.emit("ipfs:state", &s);
            }
        }
    }
}

/// Строка Kubo о невозможности взять блокировку репозитория (уже запущенный/
/// осиротевший демон). Разбор вынесен для юнит-теста.
pub fn is_lock_error(line: &str) -> bool {
    let l = line.to_lowercase();
    l.contains("someone else has the lock") || l.contains("could not obtain lock")
}

fn with_state<R>(
    shared: &SharedIpfsState,
    mutate: impl FnOnce(&mut crate::ipfs::state::IpfsState) -> R,
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

/// Гасим демон: SIGTERM, пара секунд на graceful, затем SIGKILL. На Windows —
/// `taskkill /T`, чтобы снять и дочерние процессы.
pub fn kill(child: &mut IpfsChild) -> std::io::Result<()> {
    #[cfg(unix)]
    {
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
    fn detects_lock_errors() {
        assert!(is_lock_error(
            "Error: lock /repo/repo.lock: someone else has the lock"
        ));
        assert!(is_lock_error("could not obtain lock on repo"));
        assert!(!is_lock_error("Daemon is ready"));
        assert!(!is_lock_error("Gateway server listening on /ip4/127.0.0.1/tcp/8080"));
    }
}
