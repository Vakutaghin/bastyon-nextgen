// Константы стора ленты

/** Множитель для конвертации timestamp */
export const TIMESTAMP_MULTIPLIER = 1000

/** Максимальное значение рейтинга */
export const RATING_MAX_STARS = 5

/** Множитель для округления рейтинга */
export const RATING_ROUND_MULTIPLIER = 10

/** Идентификаторы порядка сортировки */
export const SORT_ORDERS = {
  SCORE: 'score',
  DATE: 'id',
  COMMENTS: 'comment',
} as const
