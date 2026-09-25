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

  app_lib::run();
}
