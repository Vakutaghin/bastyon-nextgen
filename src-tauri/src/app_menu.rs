//! Строка меню macOS на языке приложения. Меню Tauri по умолчанию — по-английски,
//! а с языками бандла (`CFBundleLocalizations` в Info.plist) macOS дописывает в
//! него свои пункты («Эмодзи и символы», «Начать диктовку…») на языке системы:
//! выходила смесь. Состав — как у `Menu::default`, подписи присылает интерфейс
//! (`app_menu_set_labels`), до этого — русские, как у меню значка.

use serde::Deserialize;
use tauri::AppHandle;

/// Подписи меню. `{name}` в тексте — название приложения.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuLabels {
  pub about: String,
  pub services: String,
  pub hide: String,
  pub hide_others: String,
  pub show_all: String,
  pub quit: String,
  pub file: String,
  pub close_window: String,
  pub edit: String,
  pub undo: String,
  pub redo: String,
  pub cut: String,
  pub copy: String,
  pub paste: String,
  pub select_all: String,
  pub view: String,
  pub fullscreen: String,
  pub window: String,
  pub minimize: String,
  pub zoom: String,
  pub help: String,
}

impl Default for MenuLabels {
  fn default() -> Self {
    let s = |t: &str| t.to_string();
    Self {
      about: s("О программе {name}"),
      services: s("Службы"),
      hide: s("Скрыть {name}"),
      hide_others: s("Скрыть остальные"),
      show_all: s("Показать все"),
      quit: s("Завершить {name}"),
      file: s("Файл"),
      close_window: s("Закрыть окно"),
      edit: s("Правка"),
      undo: s("Отменить"),
      redo: s("Повторить"),
      cut: s("Вырезать"),
      copy: s("Скопировать"),
      paste: s("Вставить"),
      select_all: s("Выбрать все"),
      view: s("Вид"),
      fullscreen: s("Полноэкранный режим"),
      window: s("Окно"),
      minimize: s("Свернуть"),
      zoom: s("Изменить масштаб"),
      help: s("Справка"),
    }
  }
}

impl MenuLabels {
  /// `{name}` → название приложения; пустые и слишком длинные подписи — по умолчанию.
  fn resolved(mut self, name: &str) -> Self {
    let fallback = Self::default();
    let fix = |text: &mut String, default: String| {
      if text.trim().is_empty() || text.chars().count() > 80 {
        *text = default;
      }
      *text = text.replace("{name}", name);
    };
    fix(&mut self.about, fallback.about);
    fix(&mut self.services, fallback.services);
    fix(&mut self.hide, fallback.hide);
    fix(&mut self.hide_others, fallback.hide_others);
    fix(&mut self.show_all, fallback.show_all);
    fix(&mut self.quit, fallback.quit);
    fix(&mut self.file, fallback.file);
    fix(&mut self.close_window, fallback.close_window);
    fix(&mut self.edit, fallback.edit);
    fix(&mut self.undo, fallback.undo);
    fix(&mut self.redo, fallback.redo);
    fix(&mut self.cut, fallback.cut);
    fix(&mut self.copy, fallback.copy);
    fix(&mut self.paste, fallback.paste);
    fix(&mut self.select_all, fallback.select_all);
    fix(&mut self.view, fallback.view);
    fix(&mut self.fullscreen, fallback.fullscreen);
    fix(&mut self.window, fallback.window);
    fix(&mut self.minimize, fallback.minimize);
    fix(&mut self.zoom, fallback.zoom);
    fix(&mut self.help, fallback.help);
    self
  }
}

/// Меню на русском до первых подписей от интерфейса.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
  set(app, MenuLabels::default())
}

/// Подписи меню на языке приложения. Не macOS — ничего: строки меню там нет.
#[tauri::command]
pub fn app_menu_set_labels(app: AppHandle, labels: MenuLabels) -> Result<(), String> {
  set(&app, labels).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn set(app: &AppHandle, labels: MenuLabels) -> tauri::Result<()> {
  use tauri::menu::{
    AboutMetadata, Menu, PredefinedMenuItem as P, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
  };

  let name = app.package_info().name.clone();
  let l = labels.resolved(&name);
  let config = app.config();
  let about = AboutMetadata {
    name: Some(name.clone()),
    version: Some(app.package_info().version.to_string()),
    copyright: config.bundle.copyright.clone(),
    authors: config.bundle.publisher.clone().map(|p| vec![p]),
    ..Default::default()
  };
  let menu = Menu::with_items(
    app,
    &[
      &Submenu::with_items(
        app,
        &name,
        true,
        &[
          &P::about(app, Some(&l.about), Some(about))?,
          &P::separator(app)?,
          &P::services(app, Some(&l.services))?,
          &P::separator(app)?,
          &P::hide(app, Some(&l.hide))?,
          &P::hide_others(app, Some(&l.hide_others))?,
          &P::show_all(app, Some(&l.show_all))?,
          &P::separator(app)?,
          &P::quit(app, Some(&l.quit))?,
        ],
      )?,
      &Submenu::with_items(
        app,
        &l.file,
        true,
        &[&P::close_window(app, Some(&l.close_window))?],
      )?,
      &Submenu::with_items(
        app,
        &l.edit,
        true,
        &[
          &P::undo(app, Some(&l.undo))?,
          &P::redo(app, Some(&l.redo))?,
          &P::separator(app)?,
          &P::cut(app, Some(&l.cut))?,
          &P::copy(app, Some(&l.copy))?,
          &P::paste(app, Some(&l.paste))?,
          &P::select_all(app, Some(&l.select_all))?,
        ],
      )?,
      &Submenu::with_items(
        app,
        &l.view,
        true,
        &[&P::fullscreen(app, Some(&l.fullscreen))?],
      )?,
      // id окна и справки — по ним Tauri отдаёт эти меню macOS: туда она
      // сама добавляет список окон и поиск по меню.
      &Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        &l.window,
        true,
        &[
          &P::minimize(app, Some(&l.minimize))?,
          &P::maximize(app, Some(&l.zoom))?,
          &P::separator(app)?,
          &P::close_window(app, Some(&l.close_window))?,
        ],
      )?,
      &Submenu::with_id_and_items(app, HELP_SUBMENU_ID, &l.help, true, &[])?,
    ],
  )?;
  app.set_menu(menu)?;
  Ok(())
}

#[cfg(not(target_os = "macos"))]
fn set(_app: &AppHandle, _labels: MenuLabels) -> tauri::Result<()> {
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn name_is_substituted_and_bad_labels_fall_back() {
    let labels = MenuLabels {
      quit: "Quit {name}".into(),
      copy: "   ".into(),
      paste: "x".repeat(200),
      ..MenuLabels::default()
    }
    .resolved("Bastyon NextGen");
    assert_eq!(labels.quit, "Quit Bastyon NextGen");
    assert_eq!(labels.about, "О программе Bastyon NextGen");
    assert_eq!(labels.copy, "Скопировать");
    assert_eq!(labels.paste, "Вставить");
  }

  #[test]
  fn labels_come_from_the_ui_in_camel_case() {
    let json = serde_json::json!({
      "about": "About {name}", "services": "Services", "hide": "Hide {name}",
      "hideOthers": "Hide Others", "showAll": "Show All", "quit": "Quit {name}",
      "file": "File", "closeWindow": "Close Window", "edit": "Edit", "undo": "Undo",
      "redo": "Redo", "cut": "Cut", "copy": "Copy", "paste": "Paste",
      "selectAll": "Select All", "view": "View", "fullscreen": "Enter Full Screen",
      "window": "Window", "minimize": "Minimize", "zoom": "Zoom", "help": "Help"
    });
    let labels: MenuLabels = serde_json::from_value(json).expect("contract with use-tray-labels");
    assert_eq!(labels.hide_others, "Hide Others");
  }
}
