//! Главное окно. Крестик его прячет, а не завершает приложение: Tor, IPFS,
//! загрузки видео и сообщения продолжают работать в фоне. Выход — явный:
//! Cmd+Q на macOS, «Выйти» в трее или Ctrl+Q на Windows и Linux.

use tauri::{AppHandle, Manager, Window, WindowEvent};

pub const LABEL: &str = "main";

/// Вернуть главное окно: значком в Dock или трее, повторным запуском.
pub fn show(app: &AppHandle) {
  // Окно во весь экран прячется вместе с приложением (см. `hide`).
  #[cfg(target_os = "macos")]
  let _ = app.show();
  if let Some(window) = app.get_webview_window(LABEL) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// Крестик главного окна прячет его, если окно есть чем вернуть: на macOS —
/// значком в Dock, на Windows и Linux — значком в трее. Без трея (Linux без
/// appindicator) окно закрывается, как раньше, и приложение выходит.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
  let WindowEvent::CloseRequested { api, .. } = event else {
    return;
  };
  if window.label() != LABEL || !can_return(window.app_handle()) {
    return;
  }
  api.prevent_close();
  hide(window);
}

fn can_return(app: &AppHandle) -> bool {
  cfg!(target_os = "macos") || crate::tray::is_shown(app)
}

fn hide(window: &Window) {
  // Окно во весь экран на macOS занимает свой рабочий стол, и спрятанное
  // оставило бы на нём чёрный экран. Тогда прячем приложение целиком, как
  // Cmd+H: значок в Dock вернёт его на тот же стол.
  #[cfg(target_os = "macos")]
  {
    if window.is_fullscreen().unwrap_or(false) {
      let _ = window.app_handle().hide();
      return;
    }
  }
  let _ = window.hide();
}
