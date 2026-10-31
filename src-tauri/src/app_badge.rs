//! Счётчик непрочитанных сообщений на значке приложения. Число считает фронт
//! (мессенджер), здесь — как показать его системе:
//!
//! - **macOS:** цифра на значке в Dock; у значка в строке меню (если включён)
//!   число рядом с ним.
//! - **Windows:** кружок с числом поверх кнопки на панели задач (overlay icon),
//!   значок в трее с кружком и подсказкой, число в заголовке окна, кнопка на
//!   панели мигает при новом сообщении в свёрнутом окне.
//! - **Linux:** число у значка в доке и панели задач — сигнал
//!   `com.canonical.Unity.LauncherEntry` по D-Bus (Ubuntu Dock, Dash to Dock,
//!   KDE Plasma, Plank, Latte). Без libunity: Tauri ищет её, а в системах её
//!   обычно нет. Плюс трей с кружком, заголовок окна и подсветка окна.
//!
//! На Android и в браузере — свой путь (`services/app-badge` во фронте).

use std::sync::Mutex;

use tauri::{AppHandle, Manager, UserAttentionType};

/// Дальше этого число не пишем: «99+» как у кнопки мессенджера.
const MAX_SHOWN: u32 = 99;

/// Последнее показанное: значок в трее, поставленный заново, сразу с числом.
#[derive(Default)]
struct BadgeState {
  count: u32,
  tooltip: String,
}

#[derive(Default)]
pub struct AppBadge(Mutex<BadgeState>);

pub fn init(app: &AppHandle) {
  app.manage(AppBadge::default());
}

/// Текст на значке: «7», «99+».
pub fn badge_text(count: u32) -> String {
  if count > MAX_SHOWN {
    format!("{MAX_SHOWN}+")
  } else {
    count.to_string()
  }
}

/// Показать число непрочитанных. `tooltip` — подсказка трея на языке приложения
/// («Bastyon NextGen — 3 непрочитанных»); 0 убирает счётчик везде.
#[tauri::command]
pub fn app_badge_set(app: AppHandle, count: u32, tooltip: String) -> Result<(), String> {
  let previous = {
    let Some(badge) = app.try_state::<AppBadge>() else {
      return Ok(());
    };
    let mut state = badge.0.lock().unwrap_or_else(|e| e.into_inner());
    let previous = state.count;
    state.count = count;
    state.tooltip = tooltip;
    previous
  };

  apply_window(&app, count, previous);
  refresh_tray(&app);
  #[cfg(target_os = "linux")]
  launcher_entry::update(&app, count);
  Ok(())
}

/// Значок в трее появился заново (строка меню macOS включена) — вернуть число.
pub fn refresh_tray(app: &AppHandle) {
  let Some(badge) = app.try_state::<AppBadge>() else {
    return;
  };
  let (count, tooltip) = {
    let state = badge.0.lock().unwrap_or_else(|e| e.into_inner());
    (state.count, state.tooltip.clone())
  };
  let Some(tray) = app.tray_by_id(crate::tray::TRAY_ID) else {
    return;
  };

  if cfg!(target_os = "macos") {
    // Значок строки меню — одноцветный шаблон, кружок на нём не нарисовать:
    // число пишем рядом, как часы и проценты батареи.
    let title = (count > 0).then(|| badge_text(count));
    if let Err(e) = tray.set_title(title) {
      log::warn!("app badge: tray title: {e}");
    }
    return;
  }

  let icon = app.default_window_icon().map(|base| {
    if count == 0 {
      base.clone().to_owned()
    } else {
      render::tray_icon(base, &badge_text(count))
    }
  });
  if let Err(e) = tray.set_icon(icon) {
    log::warn!("app badge: tray icon: {e}");
  }
  let tip = if count > 0 && !tooltip.is_empty() {
    tooltip
  } else {
    app.package_info().name.clone()
  };
  if let Err(e) = tray.set_tooltip(Some(tip)) {
    log::warn!("app badge: tray tooltip: {e}");
  }
}

fn apply_window(app: &AppHandle, count: u32, previous: u32) {
  let Some(window) = app.get_webview_window(crate::main_window::LABEL) else {
    return;
  };

  #[cfg(target_os = "macos")]
  if let Err(e) = window.set_badge_label((count > 0).then(|| badge_text(count))) {
    log::warn!("app badge: dock: {e}");
  }

  #[cfg(target_os = "windows")]
  {
    let overlay = (count > 0).then(|| render::overlay_icon(&badge_text(count)));
    if let Err(e) = window.set_overlay_icon(overlay) {
      log::warn!("app badge: overlay: {e}");
    }
  }

  // Заголовок окна видно на панели задач Windows и Linux и в переключателе
  // окон. На macOS число уже на значке в Dock, заголовок не трогаем.
  if cfg!(any(target_os = "windows", target_os = "linux")) {
    let name = app.package_info().name.clone();
    let title = if count > 0 {
      format!("({}) {name}", badge_text(count))
    } else {
      name
    };
    if let Err(e) = window.set_title(&title) {
      log::warn!("app badge: title: {e}");
    }
  }

  // Новое сообщение, а окно свёрнуто или в трее: на Windows мигает кнопка на
  // панели задач, на Linux окно помечается срочным. На macOS Dock не дёргаем —
  // хватает цифры.
  let focused = window.is_focused().unwrap_or(true);
  if cfg!(any(target_os = "windows", target_os = "linux")) && count > previous && !focused {
    if let Err(e) = window.request_user_attention(Some(UserAttentionType::Informational)) {
      log::warn!("app badge: attention: {e}");
    }
  }
}

/// Картинки счётчика: красный кружок с белым числом. Цифры — пиксельный шрифт
/// 3×5 с целым масштабом: крупно и чётко без шрифтового движка, на 16 px
/// панели задач читается лучше сглаженного.
pub(crate) mod render {
  use tauri::image::Image;

  const RED: [u8; 3] = [0xE5, 0x39, 0x35];
  const WHITE: [u8; 3] = [0xFF, 0xFF, 0xFF];

  /// Строки глифа 3×5, старший из трёх битов — левый столбец.
  fn glyph(c: char) -> Option<[u8; 5]> {
    Some(match c {
      '0' => [0b111, 0b101, 0b101, 0b101, 0b111],
      '1' => [0b010, 0b110, 0b010, 0b010, 0b111],
      '2' => [0b111, 0b001, 0b111, 0b100, 0b111],
      '3' => [0b111, 0b001, 0b111, 0b001, 0b111],
      '4' => [0b101, 0b101, 0b111, 0b001, 0b001],
      '5' => [0b111, 0b100, 0b111, 0b001, 0b111],
      '6' => [0b111, 0b100, 0b111, 0b101, 0b111],
      '7' => [0b111, 0b001, 0b001, 0b001, 0b001],
      '8' => [0b111, 0b101, 0b111, 0b101, 0b111],
      '9' => [0b111, 0b101, 0b111, 0b001, 0b111],
      '+' => [0b000, 0b010, 0b111, 0b010, 0b000],
      _ => return None,
    })
  }

  /// RGBA-холст.
  pub struct Canvas {
    pub size: u32,
    pub rgba: Vec<u8>,
  }

  impl Canvas {
    // Пустой холст — значку на панели задач Windows (и тестам); трей рисует поверх значка приложения.
    #[cfg_attr(not(windows), allow(dead_code))]
    pub fn new(size: u32) -> Self {
      Self { size, rgba: vec![0; (size * size * 4) as usize] }
    }

    /// Пиксель поверх с непрозрачностью `alpha` (0..1).
    fn blend(&mut self, x: u32, y: u32, color: [u8; 3], alpha: f32) {
      if x >= self.size || y >= self.size || alpha <= 0.0 {
        return;
      }
      let i = ((y * self.size + x) * 4) as usize;
      let a = alpha.min(1.0);
      let dst_a = self.rgba[i + 3] as f32 / 255.0;
      let out_a = a + dst_a * (1.0 - a);
      for (k, &channel) in color.iter().enumerate() {
        let src = channel as f32;
        let dst = self.rgba[i + k] as f32;
        let v = if out_a > 0.0 { (src * a + dst * dst_a * (1.0 - a)) / out_a } else { 0.0 };
        self.rgba[i + k] = v.round() as u8;
      }
      self.rgba[i + 3] = (out_a * 255.0).round() as u8;
    }

    /// Круг со сглаженным краем.
    fn circle(&mut self, cx: f32, cy: f32, r: f32, color: [u8; 3]) {
      let (x0, x1) = ((cx - r - 1.0).max(0.0) as u32, (cx + r + 1.0) as u32);
      let (y0, y1) = ((cy - r - 1.0).max(0.0) as u32, (cy + r + 1.0) as u32);
      for y in y0..=y1 {
        for x in x0..=x1 {
          let d = ((x as f32 + 0.5 - cx).powi(2) + (y as f32 + 0.5 - cy).powi(2)).sqrt();
          self.blend(x, y, color, r + 0.5 - d);
        }
      }
    }

    /// Текст по центру точки, масштаб — целый, наибольший, при котором текст
    /// влезает в квадрат `fit`×`fit`.
    fn text(&mut self, text: &str, cx: f32, cy: f32, fit: f32, color: [u8; 3]) {
      let glyphs: Vec<[u8; 5]> = text.chars().filter_map(glyph).collect();
      if glyphs.is_empty() {
        return;
      }
      let n = glyphs.len() as f32;
      // Ширина в клетках: 3 на глиф и 1 на промежуток.
      let cells_w = n * 3.0 + (n - 1.0);
      // По высоте — не больше трёх четвертей: одна цифра иначе заполняет весь кружок.
      let scale = (fit / cells_w).min(fit * 0.75 / 5.0).floor().max(1.0) as u32;
      let w = cells_w as u32 * scale;
      let h = 5 * scale;
      let left = (cx - w as f32 / 2.0).round() as i64;
      let top = (cy - h as f32 / 2.0).round() as i64;
      for (gi, rows) in glyphs.iter().enumerate() {
        let gx = left + (gi as i64) * 4 * scale as i64;
        for (ry, row) in rows.iter().enumerate() {
          for col in 0..3u32 {
            if row & (0b100 >> col) == 0 {
              continue;
            }
            for dy in 0..scale {
              for dx in 0..scale {
                let x = gx + (col * scale + dx) as i64;
                let y = top + (ry as u32 * scale + dy) as i64;
                if x >= 0 && y >= 0 {
                  self.blend(x as u32, y as u32, color, 1.0);
                }
              }
            }
          }
        }
      }
    }

    /// Красный кружок с белым числом.
    pub fn badge(&mut self, text: &str, cx: f32, cy: f32, r: f32) {
      self.circle(cx, cy, r, RED);
      // Вписанный в круг квадрат — 1,41 r; берём чуть меньше, чтобы цифры не
      // касались края.
      self.text(text, cx, cy, r * 1.3, WHITE);
    }
  }

  /// Значок поверх кнопки на панели задач Windows: весь квадрат — кружок.
  #[cfg_attr(not(windows), allow(dead_code))]
  pub fn overlay_icon(text: &str) -> Image<'static> {
    let mut canvas = Canvas::new(32);
    canvas.badge(text, 16.0, 16.0, 15.5);
    Image::new_owned(canvas.rgba, 32, 32)
  }

  /// Значок трея: значок приложения 64×64 и кружок с числом справа снизу, как
  /// у мессенджеров.
  pub fn tray_icon(base: &Image<'_>, text: &str) -> Image<'static> {
    const SIZE: u32 = 64;
    let mut canvas = Canvas { size: SIZE, rgba: resize(base, SIZE) };
    let r = SIZE as f32 * 0.3;
    canvas.badge(text, SIZE as f32 - r - 0.5, SIZE as f32 - r - 0.5, r);
    Image::new_owned(canvas.rgba, SIZE, SIZE)
  }

  /// Уменьшение усреднением по области: значок приложения большой (512 px),
  /// трей — 16–32 px.
  pub fn resize(src: &Image<'_>, size: u32) -> Vec<u8> {
    let (sw, sh) = (src.width().max(1), src.height().max(1));
    let data = src.rgba();
    let mut out = vec![0u8; (size * size * 4) as usize];
    for y in 0..size {
      let sy0 = y * sh / size;
      let sy1 = ((y + 1) * sh / size).max(sy0 + 1).min(sh);
      for x in 0..size {
        let sx0 = x * sw / size;
        let sx1 = ((x + 1) * sw / size).max(sx0 + 1).min(sw);
        // Цвет усредняем с весом прозрачности: иначе края темнеют.
        let (mut r, mut g, mut b, mut a, mut n) = (0u64, 0u64, 0u64, 0u64, 0u64);
        for yy in sy0..sy1 {
          for xx in sx0..sx1 {
            let i = ((yy * sw + xx) * 4) as usize;
            let pa = data[i + 3] as u64;
            r += data[i] as u64 * pa;
            g += data[i + 1] as u64 * pa;
            b += data[i + 2] as u64 * pa;
            a += pa;
            n += 1;
          }
        }
        let o = ((y * size + x) * 4) as usize;
        if a > 0 {
          out[o] = (r / a) as u8;
          out[o + 1] = (g / a) as u8;
          out[o + 2] = (b / a) as u8;
        }
        out[o + 3] = (a / n.max(1)) as u8;
      }
    }
    out
  }
}

/// Счётчик у значка в доке Linux: сигнал `Update` интерфейса
/// `com.canonical.Unity.LauncherEntry`. Док сопоставляет его с ярлыком по
/// имени .desktop-файла — у .deb это «{productName}.desktop».
#[cfg(target_os = "linux")]
mod launcher_entry {
  use std::collections::HashMap;
  use std::sync::OnceLock;

  use tauri::AppHandle;
  use zbus::blocking::Connection;
  use zbus::zvariant::Value;

  const PATH: &str = "/com/canonical/unity/launcherentry/bastyon";
  const INTERFACE: &str = "com.canonical.Unity.LauncherEntry";

  /// Сессионная шина: одна на всё время работы, без неё (нет D-Bus) — None.
  fn connection() -> Option<&'static Connection> {
    static CONN: OnceLock<Option<Connection>> = OnceLock::new();
    CONN
      .get_or_init(|| match Connection::session() {
        Ok(c) => Some(c),
        Err(e) => {
          log::warn!("app badge: no session bus: {e}");
          None
        }
      })
      .as_ref()
  }

  pub fn update(app: &AppHandle, count: u32) {
    let uri = format!("application://{}.desktop", app.package_info().name);
    // Шина синхронная: из потока команды, а не из главного — окно не ждёт.
    std::thread::spawn(move || {
      let Some(conn) = connection() else {
        return;
      };
      let mut props: HashMap<&str, Value<'_>> = HashMap::new();
      props.insert("count", Value::from(count as i64));
      props.insert("count-visible", Value::from(count > 0));
      if let Err(e) = conn.emit_signal(None::<&str>, PATH, INTERFACE, "Update", &(uri.as_str(), props)) {
        log::warn!("app badge: launcher entry: {e}");
      }
    });
  }
}

#[cfg(test)]
mod tests {
  use tauri::image::Image;

  use super::render::{overlay_icon, resize, Canvas};
  use super::*;

  #[test]
  fn text_caps_at_99_plus() {
    assert_eq!(badge_text(1), "1");
    assert_eq!(badge_text(99), "99");
    assert_eq!(badge_text(100), "99+");
  }

  #[test]
  fn overlay_is_red_disc_with_white_digits() {
    let icon = overlay_icon("7");
    assert_eq!((icon.width(), icon.height()), (32, 32));
    let px = |x: u32, y: u32| {
      let i = ((y * 32 + x) * 4) as usize;
      icon.rgba()[i..i + 4].to_vec()
    };
    // Угол прозрачный, край кружка красный, середина цифры белая.
    assert_eq!(px(0, 0)[3], 0);
    assert_eq!(px(16, 2), vec![0xE5, 0x39, 0x35, 0xFF]);
    let white = icon.rgba().chunks(4).filter(|p| p == &[0xFF, 0xFF, 0xFF, 0xFF]).count();
    assert!(white > 20, "цифры не нарисованы: {white}");
  }

  #[test]
  fn three_chars_stay_inside_the_disc() {
    for text in ["8", "42", "99+"] {
      let mut c = Canvas::new(32);
      c.badge(text, 16.0, 16.0, 15.5);
      let mut white = 0;
      for (i, p) in c.rgba.chunks(4).enumerate() {
        if p != [0xFF, 0xFF, 0xFF, 0xFF] {
          continue;
        }
        white += 1;
        let (x, y) = ((i % 32) as f32 + 0.5, (i / 32) as f32 + 0.5);
        let d = ((x - 16.0).powi(2) + (y - 16.0).powi(2)).sqrt();
        assert!(d < 14.0, "{text}: цифра у края кружка ({x}, {y})");
      }
      assert!(white > 10, "{text}: цифры не нарисованы");
    }
  }

  #[test]
  fn resize_averages_with_alpha() {
    // 2×2: два непрозрачных красных и два прозрачных — в 1×1 красный с a≈127.
    let rgba = vec![255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0];
    let img = Image::new_owned(rgba, 2, 2);
    assert_eq!(resize(&img, 1), vec![255, 0, 0, 127]);
  }
}
