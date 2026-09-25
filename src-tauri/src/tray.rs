//! Значок в системном трее на Windows и Linux: видно, что приложение запущено
//! (Tor и IPFS работают в фоне), и из меню можно вернуть окно или выйти.
//! На macOS не ставим — о запущенном приложении и так говорит точка в Dock.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

const OPEN_ID: &str = "tray-open";
const QUIT_ID: &str = "tray-quit";

/// Пункты меню трея. Подписи ставит фронт на языке приложения (`tray_set_labels`),
/// до этого — русские: язык по умолчанию.
pub struct TrayMenu {
  open: MenuItem<Wry>,
  quit: MenuItem<Wry>,
}

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  if !cfg!(any(target_os = "windows", target_os = "linux")) {
    return Ok(());
  }
  if !indicator_available() {
    log::warn!("tray: no appindicator library, tray icon disabled");
    return Ok(());
  }

  let open = MenuItem::with_id(app, OPEN_ID, "Открыть Bastyon", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, QUIT_ID, "Выйти", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&open, &quit])?;

  let mut builder = TrayIconBuilder::with_id("main")
    .tooltip("Bastyon NextGen")
    .menu(&menu)
    // Левый клик возвращает окно, меню — по правому (на Linux клик не приходит,
    // там только меню).
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      OPEN_ID => show_main_window(app),
      // Через exit, а не закрытие окна: RunEvent::ExitRequested гасит Tor и IPFS.
      QUIT_ID => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        show_main_window(tray.app_handle());
      }
    });
  if let Some(icon) = app.default_window_icon() {
    builder = builder.icon(icon.clone());
  }
  builder.build(app)?;

  app.manage(TrayMenu { open, quit });
  Ok(())
}

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// На Linux значок рисует appindicator, а tray-icon подгружает его при первом
/// значке и паникует, если библиотеки нет (минимальные сборки, окружения без
/// StatusNotifier). Проверяем заранее и без неё просто живём без трея.
#[cfg(target_os = "linux")]
fn indicator_available() -> bool {
  ["libayatana-appindicator3.so.1", "libappindicator3.so.1"]
    .iter()
    // SAFETY: только dlopen/dlclose системной библиотеки, символы не вызываем.
    .any(|name| unsafe { libloading::Library::new(name) }.is_ok())
}

#[cfg(not(target_os = "linux"))]
fn indicator_available() -> bool {
  true
}

/// Подписи пунктов на языке приложения. Трея нет (macOS, Linux без
/// appindicator) — тихо ничего не делаем.
#[tauri::command]
pub fn tray_set_labels(app: AppHandle, open: String, quit: String) -> Result<(), String> {
  let Some(menu) = app.try_state::<TrayMenu>() else {
    return Ok(());
  };
  menu.open.set_text(open).map_err(|e| e.to_string())?;
  menu.quit.set_text(quit).map_err(|e| e.to_string())
}
