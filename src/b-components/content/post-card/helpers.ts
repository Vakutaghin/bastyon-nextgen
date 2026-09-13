// Хелперы компонента post-card. Семантика — ровно та, что жила инлайном в
// post-card.vue (аудит крупных файлов 2026-08: хелперы были отгружены заранее,
// но разошлись с живым кодом и никем не использовались).

import { URL_ENCODED_PATTERN, RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './consts'

/**
 * Безопасно декодирует URL-encoded строку. `+` НЕ трактуется как пробел —
 * поля поста приходят `encodeURIComponent`-кодированными.
 */
export function decodeUrlEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str
  // Префильтр — без %XX декодировать смысла нет.
  if (!URL_ENCODED_PATTERN.test(str)) return str
  try {
    const decoded = decodeURIComponent(str)
    if (decoded && decoded !== str) return decoded
  } catch {
    return str
  }
  return str
}

/**
 * Средний рейтинг в звёздах (0-5): готовое `ratingStars`, иначе из суммы и
 * количества оценок.
 */
export function calculateAverageRating(
  ratingStars: number | null | undefined,
  scoreSum: number | null | undefined,
  scoreCnt: number | null | undefined
): number {
  if (ratingStars != null) return ratingStars
  if (scoreCnt && scoreCnt > 0 && scoreSum != null) {
    const avg = scoreSum / scoreCnt
    return Math.max(
      0,
      Math.min(
        RATING_MAX_STARS,
        Math.round(avg * RATING_ROUND_MULTIPLIER) / RATING_ROUND_MULTIPLIER
      )
    )
  }
  return 0
}
