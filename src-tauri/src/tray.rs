//! Значок приложения: в трее на Windows и Linux, в строке меню на macOS. Видно,
//! что приложение запущено (Tor и IPFS работают в фоне), и из меню можно
//! вернуть окно или выйти. Крестик прячет окно сюда (см. `main_window`). На
//! macOS значок по желанию (`desktop_prefs`): о запущенном приложении и так
//! говорит точка в Dock.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

pub(crate) const TRAY_ID: &str = "main";
const OPEN_ID: &str = "tray-open";
const QUIT_ID: &str = "tray-quit";

/// Пункты меню значка. Подписи ставит фронт на языке приложения
/// (`tray_set_labels`), до этого — русские: язык по умолчанию.
struct TrayMenu {
  open: MenuItem<Wry>,
  quit: MenuItem<Wry>,
}

#[derive(Default)]
struct TrayState {
  /// Значок есть — его пункты; нет — None.
  menu: Option<TrayMenu>,
  /// Подписи последнего `tray_set_labels`: значок, поставленный заново, сразу на нужном языке.
  labels: Option<(String, String)>,
}

#[derive(Default)]
struct Tray(Mutex<TrayState>);

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  app.manage(Tray::default());
  if cfg!(target_os = "macos") {
    if !crate::desktop_prefs::menu_bar_icon() {
      return Ok(());
    }
    return build(app);
  }
  if !cfg!(any(target_os = "windows", target_os = "linux")) {
    return Ok(());
  }
  if !indicator_available() {
    log::warn!("tray: no appindicator library, tray icon disabled");
    return Ok(());
  }
  build(app)
}

fn build(app: &AppHandle) -> tauri::Result<()> {
  let tray = app.state::<Tray>();
  let mut state = tray.0.lock().unwrap_or_else(|e| e.into_inner());
  if state.menu.is_some() {
    return Ok(());
  }
  let (open_label, quit_label) = state
    .labels
    .clone()
    .unwrap_or_else(|| ("Открыть Bastyon".into(), "Выйти".into()));

  let open = MenuItem::with_id(app, OPEN_ID, open_label, true, None::<&str>)?;
  // Ctrl+Q (Cmd+Q) работает в окне, в меню — подсказка о нём.
  let quit = MenuItem::with_id(app, QUIT_ID, quit_label, true, Some("CmdOrCtrl+Q"))?;
  let menu = Menu::with_items(app, &[&open, &quit])?;

  let mut builder = TrayIconBuilder::with_id(TRAY_ID)
    .tooltip("Bastyon NextGen")
    .menu(&menu)
    .on_menu_event(|app, event| match event.id().as_ref() {
      OPEN_ID => crate::main_window::show(app),
      // Через exit, а не закрытие окна: RunEvent::ExitRequested гасит Tor и IPFS.
      QUIT_ID => app.exit(0),
      _ => {}
    });

  if cfg!(target_os = "macos") {
    // Строка меню: одноцветный шаблон (цвет macOS берёт по теме строки), меню —
    // по нажатию, как у значков системы.
    builder = builder
      .icon(tauri::include_image!("icons/tray-macos.png"))
      .icon_as_template(true)
      .show_menu_on_left_click(true);
  } else {
    // Левый клик возвращает окно, меню — по правому (на Linux клик не
    // приходит, там только меню).
    builder = builder
      .show_menu_on_left_click(false)
      .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
          ..
        } = event
        {
          crate::main_window::show(tray.app_handle());
        }
      });
    if let Some(icon) = app.default_window_icon() {
      builder = builder.icon(icon.clone());
    }
  }
  builder.build(app)?;

  state.menu = Some(TrayMenu { open, quit });
  drop(state);
  // Значок поставлен заново — сразу с числом непрочитанных.
  crate::app_badge::refresh_tray(app);
  Ok(())
}

/// Поставить или убрать значок в строке меню (macOS, настройка «Значок в строке меню»).
pub fn set_menu_bar_icon(app: &AppHandle, shown: bool) -> tauri::Result<()> {
  if shown {
    return build(app);
  }
  let Some(tray) = app.try_state::<Tray>() else {
    return Ok(());
  };
  let mut state = tray.0.lock().unwrap_or_else(|e| e.into_inner());
  state.menu = None;
  drop(app.remove_tray_by_id(TRAY_ID));
  Ok(())
}

/// Значок есть: окно, спрятанное крестиком, им можно вернуть.
pub fn is_shown(app: &AppHandle) -> bool {
  app
    .try_state::<Tray>()
    .is_some_and(|tray| tray.0.lock().unwrap_or_else(|e| e.into_inner()).menu.is_some())
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

/// Подписи пунктов на языке приложения. Значка нет — запоминаем до появления.
#[tauri::command]
pub fn tray_set_labels(app: AppHandle, open: String, quit: String) -> Result<(), String> {
  let Some(tray) = app.try_state::<Tray>() else {
    return Ok(());
  };
  let mut state = tray.0.lock().unwrap_or_else(|e| e.into_inner());
  if let Some(menu) = &state.menu {
    menu.open.set_text(&open).map_err(|e| e.to_string())?;
    menu.quit.set_text(&quit).map_err(|e| e.to_string())?;
  }
  state.labels = Some((open, quit));
  Ok(())
}
