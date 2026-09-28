//! Пока идёт диктовка, macOS не должна усыплять приложение (App Nap).
//!
//! Если окно не впереди, процесс получает крохи процессора: на проверке первая
//! загрузка модели (компиляция шейдеров Metal) шла пять минут вместо десяти
//! секунд, а нарезка на фразы отставала от записи в сотни раз. Диктовка —
//! действие пользователя: переключился на другое окно — текст всё равно
//! должен дописаться вовремя.

#[cfg(target_os = "macos")]
pub struct KeepAwake {
    activity: objc2::rc::Retained<
        objc2::runtime::ProtocolObject<dyn objc2::runtime::NSObjectProtocol>,
    >,
}

#[cfg(target_os = "macos")]
impl KeepAwake {
    pub fn begin(reason: &str) -> Self {
        use objc2_foundation::{NSActivityOptions, NSProcessInfo, NSString};
        let activity = NSProcessInfo::processInfo().beginActivityWithOptions_reason(
            // Сон системы по бездействию не запрещаем: это не видео.
            NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
            &NSString::from_str(reason),
        );
        Self { activity }
    }
}

#[cfg(target_os = "macos")]
impl Drop for KeepAwake {
    fn drop(&mut self) {
        // SAFETY: activity получен от beginActivityWithOptions:reason: того же NSProcessInfo.
        unsafe { objc2_foundation::NSProcessInfo::processInfo().endActivity(&self.activity) };
    }
}

#[cfg(not(target_os = "macos"))]
pub struct KeepAwake;

#[cfg(not(target_os = "macos"))]
impl KeepAwake {
    pub fn begin(_reason: &str) -> Self {
        Self
    }
}
