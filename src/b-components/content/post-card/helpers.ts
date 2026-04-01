// Хелперы компонента post-card

import { URL_ENCODED_PATTERN, RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './consts'

/**
 * Безопасно декодирует URL-encoded строку.
 */
export function decodeUrlEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str || ''
  if (!URL_ENCODED_PATTERN.test(str)) return str

  try {
    return decodeURIComponent(str.replace(/\+/g, ' '))
  } catch {
    return str
  }
}

/**
 * Извлекает первую букву имени для аватара-заглушки.
 */
export function getUserInitial(nameOrLetter?: string): string {
  if (!nameOrLetter) return '?'
  if (nameOrLetter.length === 1) return nameOrLetter.toUpperCase()
  return nameOrLetter.charAt(0).toUpperCase()
}

/**
 * Вычисляет средний рейтинг из суммы оценок и количества.
 */
export function calculateAverageRating(
  ratingStars: number | undefined,
  scoreSum: number | undefined,
  scoreCnt: number | undefined,
): number {
  if (typeof ratingStars === 'number' && ratingStars > 0) return ratingStars
  if (!scoreSum || !scoreCnt || scoreCnt === 0) return 0

  const avg = scoreSum / scoreCnt
  return Math.max(0, Math.min(RATING_MAX_STARS, Math.round(avg * RATING_ROUND_MULTIPLIER) / RATING_ROUND_MULTIPLIER))
}
