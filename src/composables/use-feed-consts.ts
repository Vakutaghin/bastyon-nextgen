// Константы для composable адаптации постов

/** Множитель для конвертации Unix timestamp (сек) → Date (мс) */
export const TIMESTAMP_MULTIPLIER = 1000

/** Максимальное значение рейтинга (звёзды) */
export const RATING_MAX_STARS = 5

/** Множитель для округления рейтинга */
export const RATING_ROUND_MULTIPLIER = 10

/** Значения бейджей верификации */
export const VERIFICATION_BADGES = ['verificated', 'verified'] as const

/** Значения флага реальности профиля */
export const VERIFICATION_FLAG_VALUES = [1, '1', true, 'true'] as const
