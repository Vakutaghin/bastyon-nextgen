//! Нарезка потока с микрофона на фразы по паузам.
//!
//! Каждая фраза уходит в распознавание, пока человек говорит следующую: текст
//! появляется по ходу речи, а после «Готово» остаётся дождаться только
//! последней фразы. Тишина и шум в распознавание не попадают вовсе — на них
//! whisper сочиняет «Редактор субтитров…» и «Продолжение следует…».
//!
//! Речь определяет детектор (Silero): вероятность речи на каждые 32 мс.
//! Считаются только новые кадры — с секундой звука перед ними, чтобы детектор
//! успел «вслушаться». Цена одного пересчёта постоянна, сколько бы ни длилась
//! фраза: раньше весь хвост пересчитывался заново, и на длинной речи или на
//! занятом процессоре нарезка отставала от записи.

/// Отсчётов в кадре детектора (32 мс при 16 кГц).
pub const FRAME: usize = 512;
const FRAME_MS: usize = 32;

/// Кадр считается речью от этой вероятности.
const SPEECH_PROB: f32 = 0.5;
/// Пауза, после которой фраза считается законченной.
const END_SILENCE_MS: usize = 700;
/// Короче — щелчок или кашель, а не речь.
const MIN_SPEECH_MS: usize = 250;
/// Захват до первого кадра речи и после последнего: начало и конец слова
/// детектор ловит с опозданием.
const PAD_BEFORE_MS: usize = 300;
const PAD_AFTER_MS: usize = 250;
/// Длиннее whisper распознаёт хуже, а текст ждать дольше: режем в самой тихой
/// точке последних секунд.
const MAX_UTTERANCE_MS: usize = 20_000;
const CUT_SEARCH_MS: usize = 4_000;
/// Как часто пересчитывать детектор.
const ANALYZE_EVERY_MS: usize = 256;
/// Звук перед новыми кадрами, на котором детектор «вслушивается» (у Silero
/// память короткая: секунды достаточно, чтобы вероятности совпали).
const CONTEXT_MS: usize = 1024;

fn frames(ms: usize) -> usize {
    ms.div_ceil(FRAME_MS)
}

/// Вероятность речи для каждого полного кадра `samples`.
pub trait SpeechDetector {
    fn probabilities(&mut self, samples: &[f32]) -> Result<Vec<f32>, String>;
}

pub struct Segmenter<D: SpeechDetector> {
    detector: D,
    buf: Vec<f32>,
    /// Вероятность речи для каждого полного кадра `buf`, уже посчитанная.
    probs: Vec<f32>,
    since_analysis: usize,
    speaking: bool,
}

impl<D: SpeechDetector> Segmenter<D> {
    pub fn new(detector: D) -> Self {
        Self {
            detector,
            buf: Vec::new(),
            probs: Vec::new(),
            since_analysis: 0,
            speaking: false,
        }
    }

    /// Досчитать вероятности для новых полных кадров.
    fn update_probs(&mut self) -> Result<(), String> {
        let frames_total = self.buf.len() / FRAME;
        let done = self.probs.len();
        if frames_total <= done {
            return Ok(());
        }
        let from = done.saturating_sub(frames(CONTEXT_MS));
        let fresh = self
            .detector
            .probabilities(&self.buf[from * FRAME..frames_total * FRAME])?;
        let skip = done - from;
        if fresh.len() < frames_total - from {
            return Err("engine_error: vad returned too few frames".into());
        }
        self.probs.extend_from_slice(&fresh[skip..frames_total - from]);
        Ok(())
    }

    /// Выбросить первые `n` кадров звука вместе с их вероятностями.
    fn drop_frames(&mut self, n: usize) {
        let n = n.min(self.probs.len()).min(self.buf.len() / FRAME);
        self.buf.drain(..n * FRAME);
        self.probs.drain(..n);
    }

    /// Идёт ли речь прямо сейчас (для индикатора).
    pub fn speaking(&self) -> bool {
        self.speaking
    }

    /// Добавить звук (16 кГц). Возвращает законченные фразы.
    pub fn push(&mut self, samples: &[f32]) -> Result<Vec<Vec<f32>>, String> {
        self.buf.extend_from_slice(samples);
        self.since_analysis += samples.len();
        let mut out = Vec::new();
        if self.since_analysis < frames(ANALYZE_EVERY_MS) * FRAME {
            return Ok(out);
        }
        self.since_analysis = 0;
        while let Some(utterance) = self.analyze(false)? {
            out.push(utterance);
        }
        Ok(out)
    }

    /// Запись остановлена: последняя фраза, если в хвосте была речь.
    pub fn finish(&mut self) -> Result<Option<Vec<f32>>, String> {
        let utterance = self.analyze(true)?;
        self.buf.clear();
        self.probs.clear();
        self.speaking = false;
        Ok(utterance)
    }

    fn analyze(&mut self, at_end: bool) -> Result<Option<Vec<f32>>, String> {
        self.update_probs()?;
        let probs = self.probs.clone();
        let n = probs.len();
        let is_speech = |i: usize| probs[i] >= SPEECH_PROB;
        let Some(first) = (0..n).find(|&i| is_speech(i)) else {
            self.speaking = false;
            // Речи нет: держим только запас перед возможным началом слова.
            self.drop_frames(n.saturating_sub(frames(PAD_BEFORE_MS)));
            return Ok(None);
        };
        let last = (0..n).rev().find(|&i| is_speech(i)).unwrap_or(first);
        self.speaking = n - 1 - last < frames(END_SILENCE_MS);
        let speech_frames = (first..=last).filter(|&i| is_speech(i)).count();
        let enough_speech = speech_frames >= frames(MIN_SPEECH_MS);
        let paused = at_end || n - 1 - last >= frames(END_SILENCE_MS);

        let start = first.saturating_sub(frames(PAD_BEFORE_MS)) * FRAME;
        if paused {
            if !enough_speech {
                // Щелчок, а не речь: выбрасываем вместе с паузой после него.
                self.drop_frames(last + 1);
                return Ok(None);
            }
            let end_frame = (last + 1 + frames(PAD_AFTER_MS)).min(n);
            let end = if at_end { self.buf.len() } else { end_frame * FRAME };
            let end = end.min(self.buf.len()).max(start);
            let utterance = self.buf[start..end].to_vec();
            self.drop_frames(end_frame);
            self.speaking = false;
            return Ok(Some(utterance));
        }
        if (n - first) >= frames(MAX_UTTERANCE_MS) {
            // Говорят без пауз: режем в самом тихом кадре последних секунд.
            let from = n.saturating_sub(frames(CUT_SEARCH_MS)).max(first + 1);
            let cut = (from..n)
                .min_by(|&a, &b| probs[a].total_cmp(&probs[b]))
                .unwrap_or(n - 1);
            let end = ((cut + 1) * FRAME).min(self.buf.len());
            let utterance = self.buf[start..end].to_vec();
            self.drop_frames(cut + 1);
            return Ok(Some(utterance));
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Детектор-заглушка: речь там, где отсчёты не нулевые.
    struct Energy;
    impl SpeechDetector for Energy {
        fn probabilities(&mut self, samples: &[f32]) -> Result<Vec<f32>, String> {
            Ok(samples
                .chunks_exact(FRAME)
                .map(|f| if f.iter().any(|v| v.abs() > 0.01) { 0.9 } else { 0.05 })
                .collect())
        }
    }

    fn ms(n: usize, voiced: bool) -> Vec<f32> {
        vec![if voiced { 0.3 } else { 0.0 }; n * 16]
    }

    fn feed(seg: &mut Segmenter<Energy>, audio: &[f32]) -> Vec<Vec<f32>> {
        let mut out = Vec::new();
        for chunk in audio.chunks(800) {
            out.extend(seg.push(chunk).unwrap());
        }
        out
    }

    #[test]
    fn silence_and_clicks_produce_nothing() {
        let mut seg = Segmenter::new(Energy);
        let mut audio = ms(3000, false);
        audio.extend(ms(64, true)); // щелчок
        audio.extend(ms(2000, false));
        assert!(feed(&mut seg, &audio).is_empty());
        assert!(seg.finish().unwrap().is_none());
    }

    #[test]
    fn phrases_are_cut_at_pauses() {
        let mut seg = Segmenter::new(Energy);
        let mut audio = ms(1000, false);
        audio.extend(ms(1500, true));
        audio.extend(ms(900, false));
        audio.extend(ms(1200, true));
        audio.extend(ms(900, false));
        let phrases = feed(&mut seg, &audio);
        assert_eq!(phrases.len(), 2);
        // Речь целиком плюс запас по краям, без секундной тишины в начале.
        let secs = |p: &Vec<f32>| p.len() as f32 / 16_000.0;
        assert!(secs(&phrases[0]) > 1.5 && secs(&phrases[0]) < 2.2, "{}", secs(&phrases[0]));
        assert!(secs(&phrases[1]) > 1.2 && secs(&phrases[1]) < 1.9, "{}", secs(&phrases[1]));
        assert!(seg.finish().unwrap().is_none());
    }

    #[test]
    fn short_pause_inside_a_phrase_does_not_cut() {
        let mut seg = Segmenter::new(Energy);
        let mut audio = ms(1000, true);
        audio.extend(ms(400, false)); // вдох между словами
        audio.extend(ms(1000, true));
        assert!(feed(&mut seg, &audio).is_empty());
        assert!(seg.speaking());
        let last = seg.finish().unwrap().expect("фраза при остановке");
        assert!(last.len() as f32 / 16_000.0 > 2.3);
    }

    /// Детектор, который запоминает длину каждого запроса.
    struct Counting(Vec<usize>);
    impl SpeechDetector for Counting {
        fn probabilities(&mut self, samples: &[f32]) -> Result<Vec<f32>, String> {
            self.0.push(samples.len());
            Energy.probabilities(samples)
        }
    }

    #[test]
    fn detector_sees_only_new_audio_plus_context() {
        let mut seg = Segmenter::new(Counting(Vec::new()));
        for chunk in ms(15_000, true).chunks(800) {
            seg.push(chunk).unwrap();
        }
        let longest = seg.detector.0.iter().copied().max().unwrap();
        // Секунда контекста + ~256 мс нового звука, а не вся 15-секундная фраза.
        assert!(longest <= (frames(CONTEXT_MS) + frames(ANALYZE_EVERY_MS) + 2) * FRAME, "{longest}");
    }

    #[test]
    fn long_speech_without_pauses_is_split() {
        let mut seg = Segmenter::new(Energy);
        let phrases = feed(&mut seg, &ms(45_000, true));
        assert_eq!(phrases.len(), 2);
        for p in &phrases {
            assert!(p.len() as f32 / 16_000.0 <= 20.5);
        }
        assert!(seg.finish().unwrap().is_some());
    }
}
