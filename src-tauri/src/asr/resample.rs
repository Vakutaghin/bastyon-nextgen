//! Пересчёт звука с частоты микрофона (обычно 44,1 или 48 кГц) в 16 кГц,
//! на которых работают whisper и детектор речи.
//!
//! Интерполяция windowed-sinc с окном Блэкмана: частоты выше 8 кГц срезаются
//! до прореживания, иначе они заворачивались бы в слышимый диапазон. Работает
//! потоком — куски любой длины, результат тот же, что и за один проход.

pub const TARGET_RATE: u32 = 16_000;

/// Сколько переходов через ноль sinc брать с каждой стороны.
const ZERO_CROSSINGS: f64 = 8.0;

pub struct Resampler {
    /// Шаг по входу на один выходной отсчёт (in_rate / 16000).
    step: f64,
    /// Частота среза относительно входной частоты дискретизации (0..=1).
    cutoff: f64,
    /// Полуширина ядра во входных отсчётах.
    half_width: usize,
    passthrough: bool,
    /// Необработанный хвост входа.
    buf: Vec<f32>,
    /// Абсолютный номер первого отсчёта в `buf`.
    buf_start: u64,
    /// Позиция следующего выходного отсчёта во входных отсчётах (абсолютная).
    next_t: f64,
}

impl Resampler {
    pub fn new(in_rate: u32) -> Self {
        let step = in_rate as f64 / TARGET_RATE as f64;
        // Срез чуть ниже новой частоты Найквиста: переходная полоса ядра
        // не должна заходить за 8 кГц.
        let cutoff = (1.0 / step).min(1.0) * 0.92;
        let half_width = (ZERO_CROSSINGS / cutoff).ceil() as usize;
        Self {
            step,
            cutoff,
            half_width,
            passthrough: in_rate == TARGET_RATE,
            buf: Vec::new(),
            buf_start: 0,
            next_t: 0.0,
        }
    }

    pub fn process(&mut self, input: &[f32]) -> Vec<f32> {
        if self.passthrough {
            return input.to_vec();
        }
        self.buf.extend_from_slice(input);
        let buf_end = self.buf_start + self.buf.len() as u64;
        let mut out = Vec::with_capacity((input.len() as f64 / self.step) as usize + 1);
        let hw = self.half_width as i64;
        loop {
            let center = self.next_t.floor() as i64;
            if center + hw >= buf_end as i64 {
                break;
            }
            let frac = self.next_t - center as f64;
            let mut acc = 0.0f64;
            let mut norm = 0.0f64;
            for k in (center - hw + 1)..=(center + hw) {
                let x = k as f64 - center as f64 - frac;
                let w = self.kernel(x);
                norm += w;
                if k >= self.buf_start as i64 {
                    acc += self.buf[(k - self.buf_start as i64) as usize] as f64 * w;
                }
            }
            out.push(if norm.abs() > 1e-9 { (acc / norm) as f32 } else { 0.0 });
            self.next_t += self.step;
        }
        // Выбрасываем отсчёты, которые ядру больше не понадобятся.
        let keep_from = (self.next_t.floor() as i64 - hw).max(self.buf_start as i64) as u64;
        let drop = (keep_from - self.buf_start) as usize;
        if drop > 0 {
            self.buf.drain(..drop.min(self.buf.len()));
            self.buf_start += drop as u64;
        }
        out
    }

    fn kernel(&self, x: f64) -> f64 {
        let hw = self.half_width as f64;
        if x.abs() >= hw {
            return 0.0;
        }
        let arg = std::f64::consts::PI * self.cutoff * x;
        let sinc = if arg.abs() < 1e-12 { 1.0 } else { arg.sin() / arg };
        // Окно Блэкмана по [-hw, hw].
        let n = (x + hw) / (2.0 * hw);
        let window = 0.42 - 0.5 * (2.0 * std::f64::consts::PI * n).cos()
            + 0.08 * (4.0 * std::f64::consts::PI * n).cos();
        sinc * window
    }
}

/// Смешать каналы в моно (среднее). Микрофон смешивает сам (capture.rs),
/// это — для WAV в тестах и отладочной подмене микрофона.
#[cfg(any(test, feature = "asr-file-source"))]
pub fn downmix(interleaved: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }
    interleaved
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(freq: f64, rate: u32, secs: f64) -> Vec<f32> {
        let n = (rate as f64 * secs) as usize;
        (0..n)
            .map(|i| (2.0 * std::f64::consts::PI * freq * i as f64 / rate as f64).sin() as f32)
            .collect()
    }

    fn rms(x: &[f32]) -> f64 {
        (x.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / x.len().max(1) as f64).sqrt()
    }

    /// Частота по числу переходов через ноль.
    fn freq_of(x: &[f32], rate: u32) -> f64 {
        let crossings = x.windows(2).filter(|w| w[0] <= 0.0 && w[1] > 0.0).count();
        crossings as f64 * rate as f64 / x.len() as f64
    }

    #[test]
    fn keeps_speech_band_tone() {
        for rate in [44_100, 48_000] {
            let out = Resampler::new(rate).process(&sine(1000.0, rate, 1.0));
            let body = &out[200..out.len() - 200];
            assert!((freq_of(body, TARGET_RATE) - 1000.0).abs() < 5.0, "{rate}");
            assert!((rms(body) - 0.7071).abs() < 0.02, "{rate}: {}", rms(body));
            let expected = TARGET_RATE as usize;
            assert!(out.len() > expected - 40 && out.len() <= expected, "{rate}: {}", out.len());
        }
    }

    #[test]
    fn filters_out_tones_above_8khz() {
        // 12 кГц при 48 кГц после прореживания завернулся бы в 4 кГц.
        let out = Resampler::new(48_000).process(&sine(12_000.0, 48_000, 0.5));
        assert!(rms(&out[100..out.len() - 100]) < 0.02, "{}", rms(&out));
    }

    #[test]
    fn chunked_equals_one_shot() {
        let x = sine(440.0, 44_100, 0.3);
        let whole = Resampler::new(44_100).process(&x);
        let mut r = Resampler::new(44_100);
        let mut parts = Vec::new();
        for chunk in x.chunks(313) {
            parts.extend(r.process(chunk));
        }
        assert_eq!(whole.len(), parts.len());
        for (a, b) in whole.iter().zip(&parts) {
            assert!((a - b).abs() < 1e-5);
        }
    }

    #[test]
    fn passthrough_and_downmix() {
        let x = vec![0.1, -0.2, 0.3];
        assert_eq!(Resampler::new(16_000).process(&x), x);
        assert_eq!(downmix(&[1.0, 0.0, 0.5, 0.5], 2), vec![0.5, 0.5]);
    }
}
