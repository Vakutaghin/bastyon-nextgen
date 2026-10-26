// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // WebKitGTK с 2.42 отдаёт кадры через DMA-BUF, и с проприетарным драйвером
  // NVIDIA или в виртуалке окно остаётся чёрным (Linux Mint). Прежний путь
  // отрисовки работает везде. Ставим до создания окна и потоков; значение,
  // которое пользователь задал сам, не трогаем.
  #[cfg(target_os = "linux")]
  if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  }

  // AppImage везёт свои плагины GStreamer, и его хук (linuxdeploy-plugin-
  // gstreamer) запрещает переиспользовать процесс, который их перебирает: на
  // каждый плагин — свой процесс. Путь к плагинам у каждого запуска новый
  // (/tmp/.mount_*), так что перебор идёт при каждом запуске, на первом видео
  // или звуке: 5 с против 0,5 с с одним процессом, а на слабом ноутбуке —
  // в разы дольше.
  #[cfg(target_os = "linux")]
  if std::env::var_os("APPDIR").is_some() {
    std::env::set_var("GST_REGISTRY_REUSE_PLUGIN_SCANNER", "yes");
  }

  // WKWebView исправляет слова на лету по общей настройке macOS («Исправлять
  // ошибки автоматически»), и ник, адрес или слово на другом языке в
  // сообщении меняются на что-то другое. Выключаем только у себя: это
  // значение по умолчанию, а выбор из меню поля («Правописание и грамматика»
  // → «Автоматически исправлять правописание») WebKit сохраняет поверх него.
  // WebKit читает его при создании первого окна, поэтому — до него.
  #[cfg(target_os = "macos")]
  {
    use objc2_foundation::{NSDictionary, NSNumber, NSString, NSUserDefaults};
    let key = NSString::from_str("WebAutomaticSpellingCorrectionEnabled");
    let off = NSNumber::new_bool(false);
    let defaults = NSDictionary::from_slices(&[&*key], &[&**off as &objc2::runtime::AnyObject]);
    // SAFETY: ключ и значение — строка и число, как ждут настройки.
    unsafe { NSUserDefaults::standardUserDefaults().registerDefaults(&defaults) };
  }

  app_lib::run();
}
