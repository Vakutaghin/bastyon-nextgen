// Хелперы стора ленты: извлечение постов из ответа API, рейтинги

import { RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './feed-store-consts'

/** Возможные обёртки ответа API, из которых извлекается массив постов. */
interface ApiPostsEnvelope {
  data?: { contents?: unknown[]; data?: unknown[] } | unknown[]
  result?: unknown[]
}

/**
 * Извлекает массив постов из различных форматов API-ответа.
 * API может возвращать данные в 6+ разных обёртках.
 */
export function extractPostsFromApiResponse(response: unknown): unknown[] {
  if (!response) return []

  // Прямой массив
  if (Array.isArray(response)) return response

  const envelope = response as ApiPostsEnvelope
  const { data } = envelope

  // { data: { contents: [...] } } — hierarchical strip
  if (data && !Array.isArray(data) && Array.isArray(data.contents)) {
    return data.contents
  }

  // { data: [...] }
  if (Array.isArray(data)) return data

  // { result: [...] }
  if (Array.isArray(envelope.result)) return envelope.result

  // { data: { data: [...] } } — двойная обёртка
  if (data && !Array.isArray(data) && Array.isArray(data.data)) return data.data

  return []
}

/**
 * Вычисляет рейтинг в звёздах (0-5).
 */
export function calculateRatingStars(scoreSum: number, scoreCnt: number): number {
  if (!scoreCnt || scoreCnt === 0) return 0
  const avg = scoreSum / scoreCnt
  return Math.max(0, Math.min(RATING_MAX_STARS, Math.round(avg * RATING_ROUND_MULTIPLIER) / RATING_ROUND_MULTIPLIER))
}

/**
 * Проверяет верификацию пользователя.
 */
export function isUserVerified(profile: Record<string, unknown> | null): boolean {
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges) && (badges.includes('verificated') || badges.includes('verified'))) {
    return true
  }

  const flags = profile.flags
  const real =
    (flags && typeof flags === 'object' ? (flags as Record<string, unknown>).real : undefined) ?? profile.real
  return real === 1 || real === '1' || real === true || real === 'true'
}
