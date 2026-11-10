// Свои команды приложения проходят через ACL так же, как команды плагинов:
// у каждой есть разрешение allow-*, а выдаёт их только главному окну набор
// `app-commands` (permissions/app-commands.toml, capabilities/default.json).
// Окна просмотрщика IPFS показывают чужие сайты — им не выдано ничего. Без
// этого манифеста Tauri пускал к своим командам любое окно, а до 2.11.1 и
// любую страницу в нём. Списки сверяет тест `acl_tests` в src/lib.rs.
const COMMANDS: &[&str] = &[
  "save_temp_file",
  "append_temp_file",
  "delete_temp_file",
  "get_video_metadata",
  "transcode_video",
  "cancel_transcode",
  "check_ffmpeg_available",
  "ffmpeg_module_status",
  "ffmpeg_module_install",
  "ffmpeg_module_cancel_install",
  "ffmpeg_module_remove",
  "tor_status",
  "tor_installed",
  "tor_uninstall",
  "tor_start",
  "tor_stop",
  "tor_fetch",
  "tor_set_bridges",
  "tor_request_bridges",
  "tor_ws_connect",
  "tor_ws_send",
  "tor_ws_close",
  "node_fetch",
  "node_ws_connect",
  "node_ws_send",
  "node_ws_close",
  "ipfs_status",
  "ipfs_ensure",
  "ipfs_cancel_install",
  "ipfs_stop",
  "ipfs_uninstall",
  "ipfs_pick_files",
  "ipfs_publish",
  "ipfs_seed",
  "ipfs_save_encrypted",
  "ipfs_save",
  "ipfs_cancel_save",
  "ipfs_open_viewer",
  "ipfs_viewer_status",
  "ipfs_viewer_close",
  "ipfs_pin_service_set",
  "ipfs_pin_service_status",
  "ipfs_pin_service_clear",
  "ipfs_pin_remote",
  "ipfs_shares",
  "ipfs_unshare",
  "ipfs_forget_account",
  "ipfs_share_status",
  "ipfs_sink_open",
  "ipfs_sink_write",
  "ipfs_sink_close",
  "ipfs_sink_abort",
  "ipfs_name_put",
  "tray_set_labels",
  "app_badge_set",
  "app_menu_set_labels",
  "desktop_prefs_get",
  "desktop_prefs_set",
  "asr_status",
  "asr_install",
  "asr_cancel_install",
  "asr_remove",
  "asr_start",
  "asr_stop",
  "asr_cancel",
  "asr_open_mic_settings",
  "system_info",
  "prepare_update_exit",
  "mesh_module_status",
  "mesh_module_install",
  "mesh_module_cancel_install",
  "mesh_module_remove",
  "radio_serial_ports",
  "radio_serial_open",
  "radio_tcp_open",
  "radio_write",
  "radio_close",
  "radio_ble_scan",
  "radio_ble_connect",
  "radio_ble_subscribe",
  "radio_ble_write",
  "radio_ble_read",
  "rns_start",
  "rns_stop",
  "rns_status",
  "rns_announce",
  "rns_paths",
  "rns_learn",
  "rns_send",
  "rns_request_path",
  "rns_set_propagation_node",
  "rns_sync",
  "rns_page",
  "rns_download",
  "rns_paper",
  "rns_ingest",
  "storage_usage",
  "storage_set_limits",
  "storage_clear",
  "offline_list",
  "offline_enqueue",
  "offline_pause",
  "offline_resume",
  "offline_remove",
  "offline_patch_meta",
  "offline_usage",
  "offline_clear",
  "offline_location",
  "offline_move",
];

/// Манифест Windows с Common Controls v6 — тот же, что tauri-build вшивает в
/// программу (windows-app-manifest.xml).
const COMMON_CONTROLS_MANIFEST: &str = r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
</assembly>
"#;

/// Манифест на Windows вшивает компоновщик MSVC, а не tauri-build. tauri-build
/// кладёт его в ресурс, а ресурс попадает только в программу
/// (rustc-link-arg-bins). Тестовый exe без манифеста получал старый comctl32
/// без TaskDialogIndirect и падал до первого теста: STATUS_ENTRYPOINT_NOT_FOUND
/// (0xc0000139). Компоновщик вшивает манифест во всё, что собирает, и в тесты
/// тоже. /MANIFESTUAC:NO: без него компоновщик дописал бы в манифест программы
/// trustInfo, а программа должна получить тот же манифест, что и раньше.
/// Возвращает true, если манифест вшивает компоновщик.
fn embed_manifest_by_linker() -> bool {
  let target = std::env::var("TARGET").unwrap_or_default();
  if !target.ends_with("-windows-msvc") {
    return false;
  }
  let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR"));
  let manifest = out_dir.join("app.manifest");
  std::fs::write(&manifest, COMMON_CONTROLS_MANIFEST).expect("write app.manifest");
  println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
  println!("cargo:rustc-link-arg=/MANIFESTUAC:NO");
  println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
  true
}

fn main() {
  let mut attributes =
    tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));
  if embed_manifest_by_linker() {
    attributes =
      attributes.windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
  }
  tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
