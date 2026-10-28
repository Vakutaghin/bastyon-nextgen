//! Что делает крестик окна на Windows и Linux и есть ли значок в строке меню
//! macOS (Настройки → «Система»). Хранится у Rust в данных приложения, а не у
//! страницы: крестик нажимают и до того, как она загрузилась, а значок ставится
//! при запуске.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const PREFS_FILE: &str = "desktop-prefs.json";

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static MENU_BAR_ICON: AtomicBool = AtomicBool::new(true);

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DesktopPrefs {
  /// Крестик прячет окно в трей; `false` — закрывает приложение (Windows, Linux).
  pub close_to_tray: bool,
  /// Значок Bastyon в строке меню (macOS).
  pub menu_bar_icon: bool,
}

impl Default for DesktopPrefs {
  fn default() -> Self {
    Self {
      close_to_tray: true,
      menu_bar_icon: true,
    }
  }
}

/// Что видит экран настроек: сами настройки и что есть на этой платформе.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPrefsView {
  #[serde(flatten)]
  prefs: DesktopPrefs,
  /// `macos`, `windows` или `linux`.
  platform: &'static str,
  /// Трей есть: на Linux без appindicator его нет, и крестик закрывает приложение.
  tray_available: bool,
}

struct PrefsFile(PathBuf);

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let dir = app.path().app_data_dir()?;
  std::fs::create_dir_all(&dir)?;
  let file = dir.join(PREFS_FILE);
  remember(read_prefs(&file));
  app.manage(PrefsFile(file));
  Ok(())
}

fn read_prefs(file: &Path) -> DesktopPrefs {
  std::fs::read_to_string(file)
    .ok()
    .and_then(|s| serde_json::from_str(&s).ok())
    .unwrap_or_default()
}

fn remember(prefs: DesktopPrefs) {
  CLOSE_TO_TRAY.store(prefs.close_to_tray, Ordering::Relaxed);
  MENU_BAR_ICON.store(prefs.menu_bar_icon, Ordering::Relaxed);
}

fn current() -> DesktopPrefs {
  DesktopPrefs {
    close_to_tray: CLOSE_TO_TRAY.load(Ordering::Relaxed),
    menu_bar_icon: MENU_BAR_ICON.load(Ordering::Relaxed),
  }
}

pub fn close_to_tray() -> bool {
  CLOSE_TO_TRAY.load(Ordering::Relaxed)
}

pub fn menu_bar_icon() -> bool {
  MENU_BAR_ICON.load(Ordering::Relaxed)
}

fn view(app: &AppHandle) -> DesktopPrefsView {
  DesktopPrefsView {
    prefs: current(),
    platform: if cfg!(target_os = "macos") {
      "macos"
    } else if cfg!(target_os = "windows") {
      "windows"
    } else {
      "linux"
    },
    tray_available: cfg!(target_os = "macos") || crate::tray::is_shown(app),
  }
}

#[tauri::command]
pub fn desktop_prefs_get(app: AppHandle) -> DesktopPrefsView {
  view(&app)
}

/// Сохранить и сразу применить: значок в строке меню появляется или пропадает
/// тут же, крестик ведёт себя по-новому со следующего нажатия.
#[tauri::command]
pub fn desktop_prefs_set(app: AppHandle, prefs: DesktopPrefs) -> Result<DesktopPrefsView, String> {
  let Some(file) = app.try_state::<PrefsFile>() else {
    return Err("desktop prefs are not initialised".into());
  };
  let json = serde_json::to_string(&prefs).map_err(|e| e.to_string())?;
  std::fs::write(&file.0, json).map_err(|e| e.to_string())?;
  let icon_changed = prefs.menu_bar_icon != menu_bar_icon();
  remember(prefs);
  if icon_changed && cfg!(target_os = "macos") {
    crate::tray::set_menu_bar_icon(&app, prefs.menu_bar_icon).map_err(|e| e.to_string())?;
  }
  Ok(view(&app))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn prefs_default_when_missing_or_broken_and_keep_unknown_fields_default() {
    let dir = std::env::temp_dir().join(format!("bastyon-desktop-prefs-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join(PREFS_FILE);

    assert_eq!(read_prefs(&file), DesktopPrefs::default());
    std::fs::write(&file, "not json").unwrap();
    assert_eq!(read_prefs(&file), DesktopPrefs::default());
    // Файл от версии, где была только одна настройка: вторая — по умолчанию.
    std::fs::write(&file, r#"{"closeToTray":false}"#).unwrap();
    assert_eq!(
      read_prefs(&file),
      DesktopPrefs {
        close_to_tray: false,
        menu_bar_icon: true
      }
    );
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
