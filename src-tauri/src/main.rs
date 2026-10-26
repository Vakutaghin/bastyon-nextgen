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

  app_lib::run();
}
