//! Распознавание фразы моделью whisper и детектор речи Silero.
//!
//! Модель загружается при первой диктовке и держится в памяти, пока ей
//! пользуются: повторная загрузка — доли секунды, но на Apple Silicon первая
//! после установки компилирует шейдеры Metal ~10 с.

use std::sync::OnceLock;
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperVadContext,
    WhisperVadContextParams,
};

use super::segmenter::{SpeechDetector, FRAME};

/// Видеокарта — только Metal на Apple Silicon: на Intel-маках встроенная
/// графика не быстрее процессора, а другие бэкенды в сборку не входят.
pub fn use_gpu() -> bool {
    cfg!(all(target_os = "macos", target_arch = "aarch64"))
}

/// ggml собран под x86-64 с AVX2/FMA/F16C (GGML_NATIVE=OFF, .cargo/config.toml):
/// на процессоре без них распознавание упало бы с illegal instruction вместе
/// с приложением. Такие процессоры старше 2013 года — голосовой ввод там
/// просто недоступен.
pub fn cpu_supported() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        std::arch::is_x86_feature_detected!("avx2")
            && std::arch::is_x86_feature_detected!("fma")
            && std::arch::is_x86_feature_detected!("f16c")
            && std::arch::is_x86_feature_detected!("bmi2")
    }
    #[cfg(not(target_arch = "x86_64"))]
    {
        true
    }
}

fn threads() -> i32 {
    let n = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    n.saturating_sub(1).clamp(1, 8) as i32
}

/// Логи whisper.cpp — в log, а не в stderr приложения.
fn install_logging() {
    static ONCE: OnceLock<()> = OnceLock::new();
    ONCE.get_or_init(whisper_rs::install_logging_hooks);
}

pub struct Engine {
    model_file: String,
    ctx: WhisperContext,
}

impl Engine {
    pub fn load(model_file: &str) -> Result<Self, String> {
        install_logging();
        let mut params = WhisperContextParameters::default();
        params.use_gpu = use_gpu();
        let ctx = WhisperContext::new_with_params(model_file, params)
            .map_err(|e| format!("engine_error: {e}"))?;
        Ok(Self {
            model_file: model_file.to_string(),
            ctx,
        })
    }

    pub fn model_file(&self) -> &str {
        &self.model_file
    }

    /// Текст фразы. `language` — код whisper (ru, en, ko…), `prompt` — текст
    /// перед курсором: по нему модель держит стиль, регистр и имена.
    pub fn transcribe(&self, samples: &[f32], language: &str, prompt: &str) -> Result<String, String> {
        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| format!("engine_error: {e}"))?;
        // Лучший текст даёт поиск лучом, но он вдвое дороже: там, где считает
        // видеокарта, это доли секунды, на процессоре важнее задержка.
        let strategy = if use_gpu() {
            SamplingStrategy::BeamSearch {
                beam_size: 5,
                patience: -1.0,
            }
        } else {
            SamplingStrategy::Greedy { best_of: 1 }
        };
        let mut params = FullParams::new(strategy);
        params.set_language(Some(language));
        params.set_n_threads(threads());
        params.set_translate(false);
        params.set_no_context(true);
        params.set_no_timestamps(true);
        params.set_single_segment(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        let prompt = tail_chars(prompt.trim(), 200);
        if !prompt.is_empty() {
            params.set_initial_prompt(prompt);
        }
        state
            .full(params, samples)
            .map_err(|e| format!("engine_error: {e}"))?;
        let mut text = String::new();
        for segment in state.as_iter() {
            let piece = segment.to_str_lossy().map_err(|e| format!("engine_error: {e}"))?;
            text.push_str(&piece);
        }
        Ok(clean_transcript(&text))
    }
}

/// Детектор речи Silero (whisper.cpp) на процессоре.
pub struct SileroDetector {
    ctx: WhisperVadContext,
}

impl SileroDetector {
    pub fn load(model_file: &str) -> Result<Self, String> {
        install_logging();
        let mut params = WhisperVadContextParams::new();
        params.set_n_threads(1);
        params.set_use_gpu(false);
        let ctx = WhisperVadContext::new(model_file, params)
            .map_err(|e| format!("engine_error: vad: {e}"))?;
        Ok(Self { ctx })
    }
}

impl SpeechDetector for SileroDetector {
    fn probabilities(&mut self, samples: &[f32]) -> Result<Vec<f32>, String> {
        if samples.len() < FRAME {
            return Ok(Vec::new());
        }
        self.ctx
            .detect_speech(samples)
            .map_err(|e| format!("engine_error: vad: {e}"))?;
        let probs = self.ctx.probabilities();
        Ok(probs[..probs.len().min(samples.len() / FRAME)].to_vec())
    }
}

fn tail_chars(s: &str, max: usize) -> &str {
    let count = s.chars().count();
    if count <= max {
        return s;
    }
    let skip = s.char_indices().nth(count - max).map(|(i, _)| i).unwrap_or(0);
    &s[skip..]
}

/// Фразы, которые whisper выдаёт на тишине, шуме и музыке: он учился на
/// субтитрах, и их подписи для него — «обычный текст».
const HALLUCINATIONS: &[&str] = &[
    "редактор субтитров",
    "корректор а.",
    "субтитры сделал",
    "субтитры создавал",
    "субтитры подготовил",
    "продолжение следует",
    "спасибо за просмотр",
    "подписывайтесь на канал",
    "thanks for watching",
    "thank you for watching",
    "subtitles by",
    "untertitel im auftrag",
    "untertitel der amara",
    "sous-titrage",
    "sottotitoli creati",
    "subtítulos realizados",
];

/// Убрать галлюцинации и мусор из распознанного текста.
pub fn clean_transcript(raw: &str) -> String {
    let text = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    let lower = text.to_lowercase();
    if HALLUCINATIONS.iter().any(|h| lower.contains(h)) {
        return String::new();
    }
    // Описание звука: «[МУЗЫКА]», «(смех)», «♪».
    let without_sounds = strip_sound_tags(&text);
    let text = without_sounds.trim();
    if text.is_empty() {
        return String::new();
    }
    // «СПОКОЙНАЯ МУЗЫКА», «ТЕЛЕФОННЫЙ ЗВОНОК»: так whisper подписывает звуки.
    let letters: Vec<char> = text.chars().filter(|c| c.is_alphabetic()).collect();
    let has_case = letters.iter().any(|c| c.is_lowercase() || c.is_uppercase());
    if letters.len() >= 4 && has_case && letters.iter().all(|c| !c.is_lowercase()) {
        return String::new();
    }
    if is_repetition(text) {
        return String::new();
    }
    text.to_string()
}

fn strip_sound_tags(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut depth_square = 0usize;
    let mut depth_round = 0usize;
    let mut round_buf = String::new();
    for c in text.chars() {
        match c {
            '[' => depth_square += 1,
            ']' if depth_square > 0 => depth_square -= 1,
            '♪' | '♫' => {}
            '(' if depth_square == 0 => {
                depth_round += 1;
                round_buf.clear();
            }
            ')' if depth_round > 0 => {
                depth_round -= 1;
                // Скобки с обычным текстом оставляем, с описанием звука — нет.
                let inner = round_buf.trim().to_lowercase();
                let sound = [
                    "смех", "музыка", "аплодисменты", "laughter", "music", "applause", "кашель",
                ]
                .iter()
                .any(|w| inner.contains(w));
                if !sound {
                    out.push('(');
                    out.push_str(&round_buf);
                    out.push(')');
                }
                round_buf.clear();
            }
            _ if depth_square > 0 => {}
            _ if depth_round > 0 => round_buf.push(c),
            _ => out.push(c),
        }
    }
    if depth_round > 0 {
        out.push('(');
        out.push_str(&round_buf);
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// «Слышен. Слышен. Слышен. Слышен.» — зацикливание модели на шуме.
fn is_repetition(text: &str) -> bool {
    let words: Vec<String> = text
        .split_whitespace()
        .map(|w| {
            w.trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase()
        })
        .filter(|w| !w.is_empty())
        .collect();
    if words.len() < 4 {
        return false;
    }
    let first = &words[0];
    let same = words.iter().filter(|w| *w == first).count();
    same * 10 >= words.len() * 8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_normal_speech() {
        let t = "Привет всем! Сегодня я расскажу, как мы съездили на море.";
        assert_eq!(clean_transcript(t), t);
        assert_eq!(clean_transcript("  Да,   конечно. "), "Да, конечно.");
        assert_eq!(clean_transcript("ОК"), "ОК");
        assert_eq!(clean_transcript("Встреча в (среду) утром"), "Встреча в (среду) утром");
    }

    #[test]
    fn drops_subtitle_and_sound_hallucinations() {
        for h in [
            "Редактор субтитров А.Семкин Корректор А.Егорова",
            "Продолжение следует...",
            "СПОКОЙНАЯ МУЗЫКА",
            "ТЕЛЕФОННЫЙ ЗВОНОК",
            "Слышен. Слышен. Слышен. Слышен. Слышен.",
            "[МУЗЫКА]",
            "♪ ♪",
            "Thanks for watching!",
            "(смех)",
        ] {
            assert_eq!(clean_transcript(h), "", "{h}");
        }
        assert_eq!(clean_transcript("Ну и шутка (смех) правда?"), "Ну и шутка правда?");
    }

    #[test]
    fn prompt_tail_is_cut_by_characters() {
        assert_eq!(tail_chars("абвгд", 3), "вгд");
        assert_eq!(tail_chars("abc", 10), "abc");
    }
}
