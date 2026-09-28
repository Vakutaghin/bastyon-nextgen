// Свои команды приложения проходят через ACL так же, как команды плагинов:
// у каждой есть разрешение allow-*, а выдаёт их только главному окну набор
// `app-commands` (permissions/app-commands.toml, capabilities/default.json).
// Окна просмотрщика IPFS показывают чужие сайты — им не выдано ничего. Без
// этого манифеста Tauri пускал к своим командам любое окно, а до 2.11.1 и
// любую страницу в нём. Списки сверяет тест `acl_tests` в src/lib.rs.
const COMMANDS: &[&str] = &[
  "save_temp_file",
  "delete_temp_file",
  "get_video_metadata",
  "transcode_video",
  "cancel_transcode",
  "check_ffmpeg_available",
  "tor_status",
  "tor_start",
  "tor_stop",
  "tor_fetch",
  "tor_set_bridges",
  "tor_ws_connect",
  "tor_ws_send",
  "tor_ws_close",
  "ipfs_status",
  "ipfs_ensure",
  "ipfs_cancel_install",
  "ipfs_stop",
  "ipfs_uninstall",
  "ipfs_update",
  "ipfs_pick_files",
  "ipfs_publish",
  "ipfs_seed",
  "ipfs_save_encrypted",
  "ipfs_save",
  "ipfs_cancel_save",
  "ipfs_open_viewer",
  "ipfs_pin_service_set",
  "ipfs_pin_service_status",
  "ipfs_pin_service_clear",
  "ipfs_pin_remote",
  "ipfs_shares",
  "ipfs_unshare",
  "ipfs_forget_account",
  "ipfs_share_status",
  "tray_set_labels",
  "asr_status",
  "asr_install",
  "asr_cancel_install",
  "asr_remove",
  "asr_start",
  "asr_stop",
  "asr_cancel",
];

fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new()
      .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
  )
  .expect("failed to run tauri-build");
}
