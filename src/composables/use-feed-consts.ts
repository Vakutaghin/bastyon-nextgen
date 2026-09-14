// Константы для composable адаптации постов

/** Множитель для конвертации Unix timestamp (сек) → Date (мс) */
export const TIMESTAMP_MULTIPLIER = 1000

/** Максимальное значение рейтинга (звёзды) */
export const RATING_MAX_STARS = 5

/** Множитель для округления рейтинга */
export const RATING_ROUND_MULTIPLIER = 10

/** Значения верификации живут рядом с isUserVerified; здесь — реэкспорт для барреля. */
export { VERIFICATION_BADGES, VERIFICATION_FLAG_VALUES } from '@/helpers/profile/is-user-verified'
