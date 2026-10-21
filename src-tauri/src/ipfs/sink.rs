//! Сохранение файла, который скачал узел IPFS в окне приложения — на компьютере
//! без модуля IPFS (src/helpers/ipfs/ipfs-node.ts). Системный диалог
//! «Сохранить», куски пишутся в `<имя>.part` рядом с выбранным файлом, в конце
//! — переименование. Отмена и ошибка удаляют недокачанный файл.
//!
//! Байты приходят от фронта уже проверенными по CID (ipfs-verify.ts): Rust
//! только кладёт их на диск. В WKWebView и WebKitGTK диалога сохранения у
//! страницы нет, а загрузка через `<a download>` уходила бы мимо диалога.

use super::{create_private, crypto::random_hex, err_string, part_path, safe_basename, save_file};
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Потолок файла — как MAX_FILE_BYTES на фронте (ipfs-save-sinks.ts).
const MAX_BYTES: u64 = 4 * 1024 * 1024 * 1024;

struct Sink {
    dest: PathBuf,
    part: PathBuf,
    file: File,
    written: u64,
}

/// Открытые сохранения по токену. Токен случайный: страница не угадает чужой.
#[derive(Default)]
pub struct SaveSinks(Mutex<HashMap<String, Sink>>);

impl SaveSinks {
    fn open(&self, dest: PathBuf) -> Result<String, String> {
        let part = part_path(&dest);
        let file = create_private(&part).map_err(err_string)?;
        let token = random_hex(16);
        let sink = Sink {
            dest,
            part,
            file,
            written: 0,
        };
        self.0
            .lock()
            .map_err(|_| "ipfs sink lock")?
            .insert(token.clone(), sink);
        Ok(token)
    }

    fn write(&self, token: &str, data: &[u8]) -> Result<(), String> {
        let mut sinks = self.0.lock().map_err(|_| "ipfs sink lock")?;
        let sink = sinks.get_mut(token).ok_or("unknown save")?;
        if sink.written + data.len() as u64 > MAX_BYTES {
            drop(sinks);
            self.abort(token);
            return Err("verify-too-large".into());
        }
        if let Err(e) = sink.file.write_all(data) {
            drop(sinks);
            self.abort(token);
            return Err(err_string(e));
        }
        sink.written += data.len() as u64;
        Ok(())
    }

    fn take(&self, token: &str) -> Option<Sink> {
        self.0.lock().ok()?.remove(token)
    }

    fn close(&self, token: &str) -> Result<(), String> {
        let Sink {
            dest, part, file, ..
        } = self.take(token).ok_or("unknown save")?;
        let finished = file.sync_all().and_then(|()| {
            drop(file);
            std::fs::rename(&part, &dest)
        });
        finished.map_err(|e| {
            let _ = std::fs::remove_file(&part);
            err_string(e)
        })
    }

    fn abort(&self, token: &str) {
        if let Some(Sink { part, file, .. }) = self.take(token) {
            drop(file);
            let _ = std::fs::remove_file(&part);
        }
    }
}

/// Диалог «Сохранить» с именем из ссылки (только basename). None — закрыли.
#[tauri::command]
pub async fn ipfs_sink_open(
    app: AppHandle,
    sinks: State<'_, SaveSinks>,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let Some(dest) = save_file(&app, &safe_basename(&suggested_name, "ipfs")).await else {
        return Ok(None);
    };
    sinks.open(dest).map(Some)
}

/// Кусок файла: тело — сырые байты, токен — заголовок `x-sink`.
#[tauri::command]
pub async fn ipfs_sink_write(
    request: tauri::ipc::Request<'_>,
    sinks: State<'_, SaveSinks>,
) -> Result<(), String> {
    let token = request
        .headers()
        .get("x-sink")
        .and_then(|v| v.to_str().ok())
        .ok_or("ipfs_sink_write expects x-sink")?;
    let data: &[u8] = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.as_slice(),
        _ => return Err("ipfs_sink_write expects a raw body".into()),
    };
    sinks.write(token, data)
}

/// Файл скачан: `.part` становится выбранным файлом.
#[tauri::command]
pub async fn ipfs_sink_close(sinks: State<'_, SaveSinks>, token: String) -> Result<(), String> {
    sinks.close(&token)
}

/// Отмена или ошибка: недокачанный файл удаляется.
#[tauri::command]
pub async fn ipfs_sink_abort(sinks: State<'_, SaveSinks>, token: String) -> Result<(), String> {
    sinks.abort(&token);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bastyon-sink-{name}-{}", random_hex(4)));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finished_file_replaces_part() {
        let dir = temp_dir("close");
        let dest = dir.join("photo.jpg");
        let sinks = SaveSinks::default();
        let token = sinks.open(dest.clone()).unwrap();
        sinks.write(&token, b"hello ").unwrap();
        sinks.write(&token, b"ipfs").unwrap();
        assert!(dir.join("photo.jpg.part").exists());
        sinks.close(&token).unwrap();
        assert_eq!(std::fs::read(&dest).unwrap(), b"hello ipfs");
        assert!(!dir.join("photo.jpg.part").exists());
        // Токен одноразовый.
        assert!(sinks.write(&token, b"x").is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn abort_leaves_nothing() {
        let dir = temp_dir("abort");
        let dest = dir.join("a.bin");
        let sinks = SaveSinks::default();
        let token = sinks.open(dest.clone()).unwrap();
        sinks.write(&token, b"partial").unwrap();
        sinks.abort(&token);
        assert!(!dest.exists());
        assert!(!dir.join("a.bin.part").exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn unknown_token_is_refused() {
        let sinks = SaveSinks::default();
        assert!(sinks.write("nope", b"x").is_err());
        assert!(sinks.close("nope").is_err());
    }
}
