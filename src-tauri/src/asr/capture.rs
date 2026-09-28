//! Захват звука с микрофона (cpal): моно, float, на частоте устройства.
//!
//! Звук пишется нативно, а не через getUserMedia веб-вью: на Windows и Linux
//! wry не выдаёт веб-странице доступ к микрофону, а здесь запись одинакова на
//! всех системах и никуда не уходит — в интерфейс попадает только текст.
//!
//! Поток cpal живёт в своём потоке ОС: на части платформ он не `Send`.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{ErrorKind, FromSample, SizedSample};
use std::sync::mpsc;
use std::thread::JoinHandle;

pub struct Capture {
    stop: Option<mpsc::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for Capture {
    fn drop(&mut self) {
        drop(self.stop.take());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// Начать запись. Куски моно-звука уходят в `audio`, ошибки потока — в
/// `errors`. Возвращает частоту дискретизации.
pub fn start(
    audio: mpsc::Sender<Vec<f32>>,
    errors: mpsc::Sender<String>,
) -> Result<(Capture, u32), String> {
    #[cfg(feature = "asr-file-source")]
    if let Ok(path) = std::env::var("BASTYON_ASR_FILE") {
        return file_source::start(&path, audio);
    }

    let (ready_tx, ready_rx) = mpsc::channel::<Result<u32, String>>();
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let thread = std::thread::Builder::new()
        .name("asr-capture".into())
        .spawn(move || {
            let stream = match open(audio, errors) {
                Ok((stream, rate)) => {
                    let _ = ready_tx.send(Ok(rate));
                    stream
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                    return;
                }
            };
            // Ждём остановки: отправитель закрыт — значит, пора.
            let _ = stop_rx.recv();
            drop(stream);
        })
        .map_err(|e| format!("mic_error: {e}"))?;
    let rate = ready_rx
        .recv()
        .map_err(|_| "mic_error: capture thread died".to_string())??;
    Ok((
        Capture {
            stop: Some(stop_tx),
            thread: Some(thread),
        },
        rate,
    ))
}

fn open(
    audio: mpsc::Sender<Vec<f32>>,
    errors: mpsc::Sender<String>,
) -> Result<(cpal::Stream, u32), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "no_microphone".to_string())?;
    let supported = device.default_input_config().map_err(describe)?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let rate = config.sample_rate;
    let channels = config.channels as usize;
    let stream = match format {
        cpal::SampleFormat::F32 => build::<f32>(&device, config, channels, audio, errors),
        cpal::SampleFormat::I16 => build::<i16>(&device, config, channels, audio, errors),
        cpal::SampleFormat::I32 => build::<i32>(&device, config, channels, audio, errors),
        cpal::SampleFormat::U16 => build::<u16>(&device, config, channels, audio, errors),
        cpal::SampleFormat::U8 => build::<u8>(&device, config, channels, audio, errors),
        cpal::SampleFormat::F64 => build::<f64>(&device, config, channels, audio, errors),
        other => return Err(format!("mic_error: sample format {other:?}")),
    }
    .map_err(describe)?;
    stream.play().map_err(describe)?;
    Ok((stream, rate))
}

/// Ошибка cpal → код для интерфейса.
fn describe(e: cpal::Error) -> String {
    match e.kind() {
        ErrorKind::PermissionDenied => "mic_denied".into(),
        ErrorKind::DeviceNotAvailable => "no_microphone".into(),
        ErrorKind::DeviceBusy => "mic_busy".into(),
        _ => format!("mic_error: {e}"),
    }
}

fn build<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    channels: usize,
    audio: mpsc::Sender<Vec<f32>>,
    errors: mpsc::Sender<String>,
) -> Result<cpal::Stream, cpal::Error>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    let channels = channels.max(1);
    device.build_input_stream(
        config,
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            let mono: Vec<f32> = data
                .chunks(channels)
                .map(|frame| {
                    frame.iter().map(|s| s.to_sample::<f32>()).sum::<f32>() / frame.len() as f32
                })
                .collect();
            let _ = audio.send(mono);
        },
        move |err| {
            let _ = errors.send(describe(err));
        },
        None,
    )
}

/// PCM WAV 16 бит → float. Для отладочной подмены микрофона и тестов.
#[cfg(any(test, feature = "asr-file-source"))]
pub fn read_wav(bytes: &[u8]) -> Result<(Vec<f32>, u32), String> {
    let u16le = |b: &[u8]| u16::from_le_bytes([b[0], b[1]]);
    let u32le = |b: &[u8]| u32::from_le_bytes([b[0], b[1], b[2], b[3]]);
    if bytes.len() < 12 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("not a wav file".into());
    }
    let (mut channels, mut rate, mut pos) = (0usize, 0u32, 12usize);
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let len = u32le(&bytes[pos + 4..pos + 8]) as usize;
        let body = &bytes[pos + 8..(pos + 8 + len).min(bytes.len())];
        if id == b"fmt " && body.len() >= 16 {
            if u16le(&body[0..2]) != 1 || u16le(&body[14..16]) != 16 {
                return Err("only 16-bit PCM wav".into());
            }
            channels = u16le(&body[2..4]) as usize;
            rate = u32le(&body[4..8]);
        } else if id == b"data" {
            if channels == 0 {
                return Err("wav data before fmt".into());
            }
            let samples: Vec<f32> = body
                .chunks_exact(2)
                .map(|s| i16::from_le_bytes([s[0], s[1]]) as f32 / 32768.0)
                .collect();
            return Ok((super::resample::downmix(&samples, channels), rate));
        }
        pos += 8 + len + (len & 1);
    }
    Err("wav without data".into())
}

/// Отладочная подмена микрофона: `BASTYON_ASR_FILE=фраза.wav` проигрывает
/// файл в реальном темпе, потом отдаёт тишину. Только в сборке с фичей
/// `asr-file-source` — в релиз не попадает.
#[cfg(feature = "asr-file-source")]
mod file_source {
    use super::*;
    use std::time::Duration;

    pub fn start(path: &str, audio: mpsc::Sender<Vec<f32>>) -> Result<(Capture, u32), String> {
        let bytes = std::fs::read(path).map_err(|e| format!("mic_error: {e}"))?;
        let (samples, rate) = read_wav(&bytes).map_err(|e| format!("mic_error: {e}"))?;
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let chunk = (rate / 50) as usize; // 20 мс
        let thread = std::thread::spawn(move || {
            let silence = vec![0.0f32; chunk];
            let mut pieces = samples.chunks(chunk);
            loop {
                match stop_rx.recv_timeout(Duration::from_millis(20)) {
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    _ => break,
                }
                // Микрофон, у которого отозвали доступ, отдаёт точные нули —
                // отличаем тишину файла от такого крошечным шумом.
                let piece = pieces.next().map(|p| p.to_vec()).unwrap_or_else(|| {
                    silence.iter().enumerate().map(|(i, _)| if i % 2 == 0 { 1e-4 } else { -1e-4 }).collect()
                });
                if audio.send(piece).is_err() {
                    break;
                }
            }
        });
        Ok((
            Capture {
                stop: Some(stop_tx),
                thread: Some(thread),
            },
            rate,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav(rate: u32, channels: u16, samples: &[i16]) -> Vec<u8> {
        let data: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        let mut out = Vec::new();
        out.extend(b"RIFF");
        out.extend(((36 + data.len()) as u32).to_le_bytes());
        out.extend(b"WAVEfmt ");
        out.extend(16u32.to_le_bytes());
        out.extend(1u16.to_le_bytes());
        out.extend(channels.to_le_bytes());
        out.extend(rate.to_le_bytes());
        out.extend((rate * channels as u32 * 2).to_le_bytes());
        out.extend((channels * 2).to_le_bytes());
        out.extend(16u16.to_le_bytes());
        out.extend(b"data");
        out.extend((data.len() as u32).to_le_bytes());
        out.extend(data);
        out
    }

    #[test]
    fn reads_pcm16_wav_and_downmixes() {
        let (s, rate) = read_wav(&wav(16_000, 1, &[0, 16384, -32768])).unwrap();
        assert_eq!(rate, 16_000);
        assert_eq!(s, vec![0.0, 0.5, -1.0]);
        let (s, rate) = read_wav(&wav(48_000, 2, &[16384, 0, -16384, -16384])).unwrap();
        assert_eq!(rate, 48_000);
        assert_eq!(s, vec![0.25, -0.5]);
        assert!(read_wav(b"nope").is_err());
    }
}
