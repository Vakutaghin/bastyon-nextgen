//! Подписи меню прошлого запуска. Язык приложения знает только интерфейс, а
//! строка меню macOS и меню значка ставятся раньше него: без сохранённых
//! подписей первую секунду после запуска меню у всех было русским.

use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::{AppHandle, Manager};

fn file(app: &AppHandle, name: &str) -> Option<PathBuf> {
  Some(app.path().app_data_dir().ok()?.join(name))
}

/// Сохранённые подписи; нет файла или он битый — `None`.
pub fn load<T: DeserializeOwned>(app: &AppHandle, name: &str) -> Option<T> {
  read(&file(app, name)?)
}

/// Запомнить на следующий запуск. Не вышло — меню просто начнёт с русского.
pub fn save<T: Serialize>(app: &AppHandle, name: &str, labels: &T) {
  if let Some(path) = file(app, name) {
    if let Err(e) = write(&path, labels) {
      log::warn!("{name}: {e}");
    }
  }
}

fn read<T: DeserializeOwned>(path: &Path) -> Option<T> {
  serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

fn write<T: Serialize>(path: &Path, labels: &T) -> std::io::Result<()> {
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir)?;
  }
  std::fs::write(path, serde_json::to_string(labels)?)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn keeps_labels_between_launches_and_ignores_a_broken_file() {
    let dir = std::env::temp_dir().join(format!("bastyon-labels-{}", std::process::id()));
    let path = dir.join("labels.json");
    assert_eq!(read::<(String, String)>(&path), None);
    let labels = ("Open Bastyon".to_string(), "Quit".to_string());
    write(&path, &labels).unwrap();
    assert_eq!(read(&path), Some(labels));
    std::fs::write(&path, "{").unwrap();
    assert_eq!(read::<(String, String)>(&path), None);
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
