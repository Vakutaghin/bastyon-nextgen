//! Черновик фразы: пока человек говорит, начатая фраза распознаётся заново
//! (segmenter::draft), и поле показывает слова по ходу речи, как клавиатура
//! телефона. Закончилась фраза — она распознаётся целиком, и этот текст
//! заменяет черновик.
//!
//! Черновик считается, только когда распознаванию больше нечего делать:
//! законченные фразы важнее, а на медленном телефоне черновики просто реже.
//! Если фраза закончилась, пока её черновик ещё считается, расчёт
//! прерывается — ждать его незачем. Общий для компьютера (mod.rs) и Android
//! (crates/bastyon-asr-jni).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};

struct DraftJob {
    phrase: u32,
    abort: Arc<AtomicBool>,
    reply: mpsc::Receiver<Result<String, String>>,
}

/// Не больше одного черновика в расчёте.
#[derive(Default)]
pub struct DraftSlot {
    job: Option<DraftJob>,
}

impl DraftSlot {
    pub fn busy(&self) -> bool {
        self.job.is_some()
    }

    /// Черновик фразы `phrase` ушёл в распознавание; `abort` его прерывает.
    pub fn started(
        &mut self,
        phrase: u32,
        abort: Arc<AtomicBool>,
        reply: mpsc::Receiver<Result<String, String>>,
    ) {
        self.abort();
        self.job = Some(DraftJob {
            phrase,
            abort,
            reply,
        });
    }

    /// Фраза `phrase` закончилась: её черновик больше не нужен.
    pub fn supersede(&mut self, phrase: u32) {
        if self.job.as_ref().is_some_and(|j| j.phrase <= phrase) {
            self.abort();
        }
    }

    /// Прервать черновик, если он считается.
    pub fn abort(&mut self) {
        if let Some(job) = self.job.take() {
            job.abort.store(true, Ordering::Relaxed);
        }
    }

    /// Готовый черновик: номер фразы и текст. Пустой текст и ошибка — без
    /// черновика: ошибку движка покажет распознавание самой фразы.
    pub fn poll(&mut self) -> Option<(u32, String)> {
        let job = self.job.as_ref()?;
        let result = match job.reply.try_recv() {
            Ok(r) => r,
            Err(mpsc::TryRecvError::Empty) => return None,
            Err(mpsc::TryRecvError::Disconnected) => Err(String::new()),
        };
        let phrase = job.phrase;
        self.job = None;
        match result {
            Ok(text) if !text.is_empty() => Some((phrase, text)),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job(
        slot: &mut DraftSlot,
        phrase: u32,
    ) -> (Arc<AtomicBool>, mpsc::Sender<Result<String, String>>) {
        let abort = Arc::new(AtomicBool::new(false));
        let (tx, rx) = mpsc::channel();
        slot.started(phrase, abort.clone(), rx);
        (abort, tx)
    }

    #[test]
    fn ready_draft_is_returned_once() {
        let mut slot = DraftSlot::default();
        let (_, tx) = job(&mut slot, 2);
        assert!(slot.busy());
        assert_eq!(slot.poll(), None);
        tx.send(Ok("привет как".into())).unwrap();
        assert_eq!(slot.poll(), Some((2, "привет как".into())));
        assert!(!slot.busy());
        assert_eq!(slot.poll(), None);
    }

    #[test]
    fn finished_phrase_aborts_its_draft() {
        let mut slot = DraftSlot::default();
        let (abort, tx) = job(&mut slot, 1);
        slot.supersede(0);
        assert!(slot.busy() && !abort.load(Ordering::Relaxed));
        slot.supersede(1);
        assert!(!slot.busy() && abort.load(Ordering::Relaxed));
        // Ответ прерванного расчёта уже никому не нужен.
        let _ = tx.send(Ok("поздно".into()));
        assert_eq!(slot.poll(), None);
    }

    #[test]
    fn empty_text_and_errors_give_no_draft() {
        let mut slot = DraftSlot::default();
        let (_, tx) = job(&mut slot, 0);
        tx.send(Ok(String::new())).unwrap();
        assert_eq!(slot.poll(), None);
        assert!(!slot.busy());
        let (_, tx) = job(&mut slot, 0);
        tx.send(Err("cancelled".into())).unwrap();
        assert_eq!(slot.poll(), None);
        let (_, tx) = job(&mut slot, 0);
        drop(tx);
        assert_eq!(slot.poll(), None);
        assert!(!slot.busy());
    }
}
