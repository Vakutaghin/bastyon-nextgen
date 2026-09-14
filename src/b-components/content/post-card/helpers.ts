// Хелперы компонента post-card. Семантика — ровно та, что жила инлайном в
// post-card.vue (аудит крупных файлов 2026-08: хелперы были отгружены заранее,
// но разошлись с живым кодом и никем не использовались).

import { safeDecode } from '@/helpers/content/safe-decode'
import { RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './consts'

/**
 * Декодирует URL-encoded поле поста (общий `safeDecode`, семантика legacy
 * `trydecode`); не-строки возвращает как есть.
 */
export function decodeUrlEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str
  return safeDecode(str)
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
