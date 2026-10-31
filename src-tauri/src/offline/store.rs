//! Папка скачанного ролика: `offline/<id>/`. Тот же вид на Android
//! (`filesDir/offline`) и в вебе (OPFS `offline/`):
//! - `video.mp4` — ролик, на время загрузки `video.mp4.part`;
//! - `thumb.jpg`, `avatar.jpg`, `captions/<язык>.vtt` — обложка, аватар
//!   автора, субтитры;
//! - `meta.json` — что показать без сети; пишет страница, Rust его не
//!   разбирает;
//! - `state.json` — ход загрузки;
//! - `job.json` — откуда качать, чтобы продолжить после перезапуска;
//! - `sha256.json` — суммы фрагментов этого файла с ноды.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const VIDEO: &str = "video.mp4";
pub const PART: &str = "video.mp4.part";
pub const META: &str = "meta.json";
const STATE: &str = "state.json";
const JOB: &str = "job.json";
pub const HASHES: &str = "sha256.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Queued,
    Downloading,
    Paused,
    Failed,
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    pub status: Status,
    /// Скачано подряд с начала файла.
    pub received: u64,
    /// Размер файла; 0 — ещё не известен.
    pub total: u64,
    /// Причина паузы или сбоя: `network`, `not_found`, `hash_mismatch`,
    /// `no_space`, `disk_full`, `tor_not_ready`, `io`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl State {
    pub fn queued(total: u64) -> Self {
        Self {
            status: Status::Queued,
            received: 0,
            total,
            error: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Extra {
    /// `thumb.jpg`, `avatar.jpg` или `captions/<язык>.vtt`.
    pub name: String,
    pub url: String,
}

/// Что качать. Собирает страница: она знает архивы, зеркала и прокси.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    /// Адреса одного и того же файла по порядку: рядом с плейлистом, исходная
    /// нода, архив.
    pub sources: Vec<String>,
    /// Имя файла в `segmentsSha256Url` (последняя часть `fileUrl`).
    pub file_name: String,
    #[serde(default)]
    pub sha256_urls: Vec<String>,
    #[serde(default)]
    pub extras: Vec<Extra>,
    /// Размер из описания ролика; точный приходит в `Content-Range`.
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Item {
    pub id: String,
    pub meta: serde_json::Value,
    pub state: State,
}

/// `<uuid>-<высота>`: буквы, цифры, `-` и `_`. Ничего, что уведёт путь из папки.
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Имена дополнительных файлов, которые можно скачать и отдать странице.
pub fn valid_extra_name(name: &str) -> bool {
    if name == "thumb.jpg" || name == "avatar.jpg" {
        return true;
    }
    match name
        .strip_prefix("captions/")
        .and_then(|rest| rest.strip_suffix(".vtt"))
    {
        Some(lang) => {
            !lang.is_empty()
                && lang.len() <= 32
                && lang
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        }
        None => false,
    }
}

pub fn valid_url(url: &str) -> bool {
    url::Url::parse(url)
        .map(|u| matches!(u.scheme(), "https" | "http") && u.host_str().is_some())
        .unwrap_or(false)
}

impl Job {
    pub fn validate(&self) -> Result<(), String> {
        if !valid_id(&self.id) {
            return Err("invalid_id".into());
        }
        if self.sources.is_empty() || !self.sources.iter().all(|u| valid_url(u)) {
            return Err("invalid_sources".into());
        }
        if !self.sha256_urls.iter().all(|u| valid_url(u)) {
            return Err("invalid_sources".into());
        }
        if !self
            .extras
            .iter()
            .all(|e| valid_extra_name(&e.name) && valid_url(&e.url))
        {
            return Err("invalid_extras".into());
        }
        Ok(())
    }
}

pub fn item_dir(root: &Path, id: &str) -> PathBuf {
    root.join(id)
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
}

/// Через временный файл: оборванная запись не оставит пол-JSON.
fn write_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(value).map_err(std::io::Error::other)?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)
}

pub fn read_state(dir: &Path) -> Option<State> {
    read_json(&dir.join(STATE))
}

pub fn write_state(dir: &Path, state: &State) -> std::io::Result<()> {
    write_json(&dir.join(STATE), state)
}

pub fn read_job(dir: &Path) -> Option<Job> {
    read_json(&dir.join(JOB))
}

pub fn write_job(dir: &Path, job: &Job) -> std::io::Result<()> {
    write_json(&dir.join(JOB), job)
}

pub fn read_meta(dir: &Path) -> Option<serde_json::Value> {
    read_json::<serde_json::Value>(&dir.join(META)).filter(|v| v.is_object())
}

pub fn write_meta(dir: &Path, meta: &serde_json::Value) -> std::io::Result<()> {
    write_json(&dir.join(META), meta)
}

pub fn read_item(root: &Path, id: &str) -> Option<Item> {
    let dir = item_dir(root, id);
    let meta = read_meta(&dir)?;
    let state = read_state(&dir).unwrap_or_else(|| {
        // Состояние потерялось: готовый файл — скачан, иначе — с начала.
        if dir.join(VIDEO).is_file() {
            let total = std::fs::metadata(dir.join(VIDEO)).map(|m| m.len()).unwrap_or(0);
            State {
                status: Status::Done,
                received: total,
                total,
                error: None,
            }
        } else {
            State {
                status: Status::Failed,
                received: 0,
                total: 0,
                error: Some("io".into()),
            }
        }
    });
    Some(Item {
        id: id.to_string(),
        meta,
        state,
    })
}

/// Все ролики в папке. Без `meta.json` — недописанная постановка, её не видно.
pub fn list(root: &Path) -> Vec<Item> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut items: Vec<Item> = entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().to_string();
            if valid_id(&id) {
                read_item(root, &id)
            } else {
                None
            }
        })
        .collect();
    items.sort_by(|a, b| a.id.cmp(&b.id));
    items
}

/// Слить поля в `meta.json`. `id` не меняется.
pub fn patch_meta(dir: &Path, patch: &serde_json::Value) -> Result<serde_json::Value, String> {
    let mut meta = read_meta(dir).ok_or("not_found")?;
    let Some(fields) = patch.as_object() else {
        return Err("invalid_patch".into());
    };
    let target = meta.as_object_mut().ok_or("not_found")?;
    for (key, value) in fields {
        if key == "id" {
            continue;
        }
        if value.is_null() {
            target.remove(key);
        } else {
            target.insert(key.clone(), value.clone());
        }
    }
    write_meta(dir, &meta).map_err(|e| e.to_string())?;
    Ok(meta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_and_names_cannot_leave_the_folder() {
        assert!(valid_id("238e3bd3-e707-4cb1-acb2-06b8594b71a5-360"));
        assert!(!valid_id(""));
        assert!(!valid_id("../x"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id("a.b"));
        assert!(valid_extra_name("thumb.jpg"));
        assert!(valid_extra_name("captions/pt-BR.vtt"));
        assert!(!valid_extra_name("captions/../meta.vtt"));
        assert!(!valid_extra_name("captions/.vtt"));
        assert!(!valid_extra_name("video.mp4"));
        assert!(!valid_extra_name("meta.json"));
        assert!(valid_url("https://peertube701.pocketnet.app/static/x.mp4"));
        assert!(!valid_url("file:///etc/passwd"));
        assert!(!valid_url("bastyon-offline://localhost/x"));
    }

    #[test]
    fn patch_merges_and_keeps_id() {
        let dir = std::env::temp_dir().join(format!("bastyon-offline-meta-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        write_meta(&dir, &serde_json::json!({ "id": "a", "title": "t", "accounts": ["x"] })).unwrap();
        let meta = patch_meta(
            &dir,
            &serde_json::json!({ "id": "b", "accounts": ["x", "y"], "title": null, "authorDeleted": 5 }),
        )
        .unwrap();
        assert_eq!(meta, serde_json::json!({ "id": "a", "accounts": ["x", "y"], "authorDeleted": 5 }));
        assert_eq!(read_meta(&dir).unwrap(), meta);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
