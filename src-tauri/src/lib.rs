mod tor;

use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
struct VideoMetadata {
    width: u32,
    height: u32,
    duration: f64,
    fps: f64,
    has_audio: bool,
    video_bitrate: Option<u32>,
    audio_bitrate: Option<u32>,
    mime_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TranscodeResult {
    output_path: String,
    width: u32,
    height: u32,
    duration: f64,
    file_size: u64,
}

/// Сохранить файл во временную директорию
#[tauri::command]
async fn save_temp_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    // Получаем временную директорию через std::env
    let temp_dir = env::temp_dir();
    let file_path = temp_dir.join(format!("tauri_video_{}_{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .unwrap().as_secs(),
        file_name));

    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(&data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Удалить временный файл
#[tauri::command]
async fn delete_temp_file(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete temp file: {}", e))?;
    Ok(())
}

/// Читать файл
#[tauri::command]
async fn read_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
struct FfmpegAvailability {
    ffmpeg: bool,
    ffprobe: bool,
    ffmpeg_version: Option<String>,
}

/// Проверить, доступны ли системные ffmpeg/ffprobe и вернуть версию ffmpeg.
/// Вызывается при старте Tauri приложения, чтобы UI мог показать инструкцию по установке
/// до того, как пользователь выберет файл и упрётся в невнятную ошибку "Failed to execute ffprobe".
#[tauri::command]
async fn check_ffmpeg_available() -> Result<FfmpegAvailability, String> {
    let ffmpeg_output = Command::new("ffmpeg").arg("-version").output();
    let ffprobe_output = Command::new("ffprobe").arg("-version").output();

    let ffmpeg_version = ffmpeg_output.as_ref().ok().and_then(|out| {
        if !out.status.success() {
            return None;
        }
        let stdout = String::from_utf8_lossy(&out.stdout);
        // Первая строка ffmpeg -version: "ffmpeg version 6.1.1 Copyright (c) ..."
        stdout.lines().next().map(|s| s.trim().to_string())
    });

    Ok(FfmpegAvailability {
        ffmpeg: ffmpeg_output.map(|o| o.status.success()).unwrap_or(false),
        ffprobe: ffprobe_output.map(|o| o.status.success()).unwrap_or(false),
        ffmpeg_version,
    })
}

/// Получить метаданные видео через FFmpeg (используя системный ffmpeg через команду)
#[tauri::command]
async fn get_video_metadata(file_path: String) -> Result<VideoMetadata, String> {
    use std::process::Command;

    // Используем ffprobe для получения метаданных (быстрее и надежнее)
    // Получаем все потоки (видео и аудио), чтобы проверить наличие аудио
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("stream=width,height,r_frame_rate,duration,bit_rate,codec_type")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("json")
        .arg(&file_path)
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe error: {}", stderr));
    }

    let json_output = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&json_output)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    // Парсим метаданные
    let streams_array = json.get("streams")
        .and_then(|s| s.as_array());

    // Находим первый видео поток
    let video_stream = streams_array
        .and_then(|a| a.iter().find(|s| {
            s.get("codec_type")
                .and_then(|t| t.as_str())
                .map(|t| t == "video")
                .unwrap_or(false)
        }));

    let format = json.get("format");

    let (width, height, fps, video_bitrate) = if let Some(stream) = video_stream {
        let width = stream.get("width")
            .and_then(|w| w.as_u64())
            .map(|w| w as u32)
            .unwrap_or(0);

        let height = stream.get("height")
            .and_then(|h| h.as_u64())
            .map(|h| h as u32)
            .unwrap_or(0);

        // Парсим FPS из r_frame_rate (например, "30/1")
        let fps_value = stream.get("r_frame_rate")
            .and_then(|f| f.as_str())
            .and_then(|f| {
                let parts: Vec<&str> = f.split('/').collect();
                if parts.len() == 2 {
                    let num = parts[0].parse::<f64>().ok()?;
                    let den = parts[1].parse::<f64>().ok()?;
                    if den > 0.0 {
                        Some(num / den)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .unwrap_or(30.0);

        let bitrate = stream.get("bit_rate")
            .and_then(|b| b.as_str())
            .and_then(|b| b.parse::<u64>().ok())
            .map(|b| (b / 1000) as u32);

        (width, height, fps_value, bitrate)
    } else {
        (0, 0, 30.0, None)
    };

    // Получаем длительность
    let duration = format
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    // Проверяем наличие аудио
    let has_audio = json.get("streams")
        .and_then(|s| s.as_array())
        .map(|a| a.iter().any(|s| {
            s.get("codec_type")
                .and_then(|t| t.as_str())
                .map(|t| t == "audio")
                .unwrap_or(false)
        }))
        .unwrap_or(false);

    // Получаем битрейт аудио
    let audio_bitrate = json.get("streams")
        .and_then(|s| s.as_array())
        .and_then(|a| a.iter().find(|s| {
            s.get("codec_type")
                .and_then(|t| t.as_str())
                .map(|t| t == "audio")
                .unwrap_or(false)
        }))
        .and_then(|s| s.get("bit_rate"))
        .and_then(|b| b.as_str())
        .and_then(|b| b.parse::<u64>().ok())
        .map(|b| (b / 1000) as u32);

    Ok(VideoMetadata {
        width,
        height,
        duration,
        fps,
        has_audio,
        video_bitrate,
        audio_bitrate,
        mime_type: None,
    })
}

/// Транскодировать видео через FFmpeg (используя системный ffmpeg)
#[tauri::command]
async fn transcode_video(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    video_bitrate: u32,
    audio_bitrate: u32,
    fps: u32,
    has_audio: bool,
    duration: f64, // Длительность видео для расчета прогресса
    codec: Option<String>, // "h264" (default, MP4/AAC) | "vp9" (WebM/Opus)
) -> Result<TranscodeResult, String> {

    let codec = codec.unwrap_or_else(|| "h264".to_string());
    let (extension, format) = match codec.as_str() {
        "vp9" => ("webm", "webm"),
        "h264" => ("mp4", "mp4"),
        other => return Err(format!("Unsupported codec: {}", other)),
    };

    // Создаем выходной файл
    let output_path = if output_path.is_empty() {
        let temp_dir = env::temp_dir();
        temp_dir.join(format!("tauri_output_{}.{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                .unwrap().as_secs(),
            extension))
            .to_string_lossy().to_string()
    } else {
        output_path
    };

    // Строим команду FFmpeg
    let mut ffmpeg_cmd = Command::new("ffmpeg");

    ffmpeg_cmd
        .arg("-i")
        .arg(&input_path)
        .arg("-map")
        .arg("0:v:0") // Явно указываем использовать первый видео поток
        .arg("-b:v")
        .arg(format!("{}k", video_bitrate))
        .arg("-r")
        .arg(format!("{}", fps))
        .arg("-vf")
        .arg(format!("scale={}:{}", width, height))
        .arg("-threads")
        .arg("4");

    if codec == "vp9" {
        ffmpeg_cmd
            .arg("-c:v")
            .arg("libvpx-vp9")
            .arg("-speed")
            .arg("2")
            .arg("-row-mt")
            .arg("1");
    } else {
        // h264 — preset fast как баланс скорость/качество; yuv420p и +faststart нужны для
        // максимальной совместимости (QuickTime, iOS Safari, Twitter, и т.п.)
        ffmpeg_cmd
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("fast")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-movflags")
            .arg("+faststart");
    }

    // Обработка аудио
    if has_audio && audio_bitrate > 0 {
        let (audio_codec, sample_rate) = if codec == "vp9" {
            ("libopus", "48000")
        } else {
            ("aac", "44100")
        };
        ffmpeg_cmd
            .arg("-map")
            .arg("0:a:0?") // ? делает поток опциональным — не упадём, если аудио нет
            .arg("-c:a")
            .arg(audio_codec)
            .arg("-b:a")
            .arg(format!("{}k", audio_bitrate))
            .arg("-ar")
            .arg(sample_rate)
            .arg("-ac")
            .arg("2");
    } else {
        ffmpeg_cmd.arg("-an");
    }

    ffmpeg_cmd
        .arg("-f")
        .arg(format)
        .arg("-progress")
        .arg("pipe:1") // Выводим прогресс в stdout
        .arg("-y") // Перезаписать выходной файл
        .arg(&output_path);

    // Отправляем начальный прогресс
    let _ = app.emit("transcode-progress", serde_json::json!({
        "progress": 0.0,
        "currentTime": 0.0,
        "duration": duration
    }));

    // Запускаем FFmpeg с перехватом stdout и stderr для прогресса
    let mut child = ffmpeg_cmd
        .stderr(Stdio::piped()) // stderr для прогресса и ошибок
        .stdout(Stdio::piped()) // stdout для формата progress
        .spawn()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    // Отправляем прогресс инициализации (3%)
    let _ = app.emit("transcode-progress", serde_json::json!({
        "progress": 3.0,
        "currentTime": 0.0,
        "duration": duration
    }));

    // Читаем stderr для отслеживания прогресса (FFmpeg выводит frame=... в stderr)
    let app_handle = app.clone();
    let duration_clone = duration;
    let start_time = std::time::Instant::now();
    let encoding_started = Arc::new(Mutex::new(false));

    // Используем канал для синхронизации завершения чтения прогресса
    let (tx, rx) = tokio::sync::oneshot::channel::<f64>();

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let encoding_started_clone = encoding_started.clone();
        let tx = tx; // Перемещаем tx в замыкание

        tokio::spawn(async move {
            let mut last_progress = 3.0;
            let mut final_progress = 3.0;

            for line in reader.lines() {
                if let Ok(line) = line {
                    // Парсим строку вида "frame=  123 fps= 25 q=28.0 size=    1024kB time=00:00:05.00 bitrate=1677.7kbits/s speed=1.2x"
                    if line.contains("time=") && line.contains("frame=") {
                        // Отмечаем, что кодирование началось
                        {
                            let mut started = encoding_started_clone.lock().await;
                            if !*started {
                                *started = true;
                                // Отправляем событие начала кодирования (8%)
                                let _ = app_handle.emit("transcode-progress", serde_json::json!({
                                    "progress": 8.0,
                                    "currentTime": 0.0,
                                    "duration": duration_clone
                                }));
                                last_progress = 8.0;
                            }
                        }

                        if let Some(time_part) = line.split("time=").nth(1) {
                            if let Some(time_str) = time_part.split_whitespace().next() {
                                // Парсим время в формате HH:MM:SS.mmm
                                let time_parts: Vec<&str> = time_str.split(':').collect();
                                if time_parts.len() == 3 {
                                    if let (Ok(hours), Ok(mins), Ok(secs)) = (
                                        time_parts[0].parse::<f64>(),
                                        time_parts[1].parse::<f64>(),
                                        time_parts[2].parse::<f64>()
                                    ) {
                                        let current_time = hours * 3600.0 + mins * 60.0 + secs;

                                        // Вычисляем прогресс: 8% за инициализацию, 92% за кодирование
                                        let encoding_progress = if duration_clone > 0.0 {
                                            (current_time / duration_clone * 92.0).min(92.0).max(0.0)
                                        } else {
                                            0.0
                                        };
                                        let total_progress = 8.0 + encoding_progress;
                                        final_progress = total_progress;

                                        // Отправляем обновление при изменении на 0.3% или больше
                                        if (total_progress - last_progress).abs() >= 0.3 {
                                            last_progress = total_progress;
                                            let _ = app_handle.emit("transcode-progress", serde_json::json!({
                                                "progress": total_progress,
                                                "currentTime": current_time,
                                                "duration": duration_clone
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Сигнализируем, что чтение прогресса завершено
            let _ = tx.send(final_progress);
        });
    }

    // Запускаем таймер для плавного прогресса во время инициализации
    let app_handle_timer = app.clone();
    let duration_timer = duration;
    let start_time_timer = start_time;
    let encoding_started_timer = encoding_started.clone();

    tokio::spawn(async move {
        let mut last_reported = 3.0;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

            // Проверяем, началось ли кодирование
            let started = {
                let guard = encoding_started_timer.lock().await;
                *guard
            };

            if started {
                break; // Кодирование началось, таймер больше не нужен
            }

            // Если прошло больше 1 секунды, постепенно увеличиваем прогресс
            let elapsed = start_time_timer.elapsed().as_secs_f64();
            if elapsed > 1.0 {
                // Плавно увеличиваем прогресс от 3% до 8% за 3 секунды
                let init_progress = 3.0 + ((elapsed - 1.0).min(3.0) / 3.0 * 5.0);
                if (init_progress - last_reported).abs() >= 0.5 {
                    last_reported = init_progress;
                    let _ = app_handle_timer.emit("transcode-progress", serde_json::json!({
                        "progress": init_progress,
                        "currentTime": 0.0,
                        "duration": duration_timer
                    }));
                }
            }

            // Останавливаем таймер через 10 секунд
            if elapsed > 10.0 {
                break;
            }
        }
    });

    // Ждем завершения процесса и получаем вывод
    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", stderr));
    }

    // Ждем завершения чтения прогресса (с таймаутом 1 секунда)
    // Это дает время асинхронной задаче завершить обработку всех строк прогресса
    let final_progress = match tokio::time::timeout(tokio::time::Duration::from_secs(1), rx).await {
        Ok(Ok(progress)) => progress,
        _ => 95.0 // Если таймаут или ошибка, используем 95% как последний известный прогресс
    };

    // Отправляем финальный прогресс (100%) только после завершения чтения
    // Убеждаемся, что прогресс не меньше последнего известного
    let final_progress_value = final_progress.max(95.0).min(100.0);
    let _ = app.emit("transcode-progress", serde_json::json!({
        "progress": final_progress_value,
        "currentTime": duration,
        "duration": duration
    }));

    // Если еще не 100%, отправляем финальный 100%
    if final_progress_value < 100.0 {
        let _ = app.emit("transcode-progress", serde_json::json!({
            "progress": 100.0,
            "currentTime": duration,
            "duration": duration
        }));
    }

    // Получаем информацию о выходном файле
    let metadata = fs::metadata(&output_path)
        .map_err(|e| format!("Failed to get output file metadata: {}", e))?;

    // Получаем длительность из исходного файла
    let input_metadata = get_video_metadata(input_path.clone()).await?;

    Ok(TranscodeResult {
        output_path,
        width,
        height,
        duration: input_metadata.duration,
        file_size: metadata.len(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
          #[cfg(target_os = "macos")]
          let cmd_r_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyR);
          #[cfg(not(target_os = "macos"))]
          let cmd_r_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyR);

          let f12_shortcut = Shortcut::new(None, Code::F12);
          let ctrl_shift_i = Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyI,
          );

          if event.state() == ShortcutState::Pressed {
            if shortcut == &cmd_r_shortcut {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.location.reload()");
              } else if let Some(window) = app.webview_windows().values().next() {
                let _ = window.eval("window.location.reload()");
              }
            } else if shortcut == &f12_shortcut || shortcut == &ctrl_shift_i {
              // F12 или Ctrl+Shift+I — открыть DevTools (работает и в release для отладки)
              if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
              } else if let Some(window) = app.webview_windows().values().next() {
                window.open_devtools();
              }
            }
          }
        })
        .build(),
    )
    .invoke_handler(tauri::generate_handler![
      save_temp_file,
      delete_temp_file,
      read_file,
      get_video_metadata,
      transcode_video,
      check_ffmpeg_available,
      tor::tor_status,
      tor::tor_start,
      tor::tor_stop,
      tor::tor_fetch,
      tor::tor_set_bridges,
      tor::tor_ws_connect,
      tor::tor_ws_send,
      tor::tor_ws_close,
    ])
    .setup(|app| {
      #[cfg(debug_assertions)]
      {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;

        // Получаем окно и настраиваем его размер равным размеру экрана
        // Пробуем получить окно по имени "main", если не найдено - берем первое доступное
        let window = if let Some(w) = app.get_webview_window("main") {
          Some(w)
        } else {
          app.webview_windows().values().next().cloned()
        };

        if let Some(window) = window {
          // Раскрываем окно во весь доступный экран (учитывая dock/menu bar).
          // Раньше использовали monitor.size() как LogicalSize, но это физические
          // пиксели — на retina-экранах окно становилось вдвое больше нужного.
          let _ = window.maximize();

          // Открываем dev tools автоматически в режиме разработки
          window.open_devtools();

          // Устанавливаем масштаб 120% для dev tools и всего окна
          // Zoom level 1.2 = 120%
          let _ = window.set_zoom(1.2);

          // Регистрируем глобальный шорткат Cmd+R (Mac) / Ctrl+R (Windows/Linux) для обновления страницы
          #[cfg(target_os = "macos")]
          let cmd_r_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyR);
          #[cfg(not(target_os = "macos"))]
          let cmd_r_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyR);
          let _ = app.handle().global_shortcut().register(cmd_r_shortcut);
        }
      }
      #[cfg(not(debug_assertions))]
      {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // F12 и Ctrl+Shift+I — открыть DevTools (и в release, чтобы отлаживать пустой экран и т.п.)
      let f12 = Shortcut::new(None, Code::F12);
      let ctrl_shift_i = Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::SHIFT),
        Code::KeyI,
      );
      let _ = app.handle().global_shortcut().register(f12);
      let _ = app.handle().global_shortcut().register(ctrl_shift_i);

      // Флаг для фронтенда (кнопка загрузки видео и др.) — и в debug, и в release
      let app_handle = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        if let Some(w) = app_handle.get_webview_window("main") {
          let _ = w.eval("console.log('[Tauri] URL:', location.href, '| HTML length:', document.documentElement.outerHTML.length); window.__TAURI_APP_READY__ = true;");
        } else if let Some(w) = app_handle.webview_windows().values().next() {
          let _ = w.eval("console.log('[Tauri] URL:', location.href, '| HTML length:', document.documentElement.outerHTML.length); window.__TAURI_APP_READY__ = true;");
        }
      });

      // Tor manager — initialise app state holder.
      tor::init(app.handle()).map_err(|e| e.to_string())?;

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let RunEvent::ExitRequested { .. } = event {
        // Best-effort synchronous shutdown of the tor child process so we don't
        // leave an orphaned `tor` binary after the app window closes.
        if let Some(mgr) = app_handle.try_state::<tor::TorManager>() {
          if let Ok(mut guard) = mgr.child.lock() {
            if let Some(mut child) = guard.take() {
              let _ = tor::process::kill(&mut child);
            }
          }
        }
      }
    });
}
