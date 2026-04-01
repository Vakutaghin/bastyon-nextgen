// Хелперы стора ленты: извлечение постов из ответа API, рейтинги

import { RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './feed-store-consts'

/**
 * Извлекает массив постов из различных форматов API-ответа.
 * API может возвращать данные в 6+ разных обёртках.
 */
export function extractPostsFromApiResponse(response: any): any[] {
  if (!response) return []

  // Прямой массив
  if (Array.isArray(response)) return response

  // { data: { contents: [...] } } — hierarchical strip
  if (response?.data?.contents && Array.isArray(response.data.contents)) {
    return response.data.contents
  }

  // { data: [...] }
  if (Array.isArray(response?.data)) return response.data

  // { result: [...] }
  if (Array.isArray(response?.result)) return response.result

  // { data: { data: [...] } } — двойная обёртка
  if (Array.isArray(response?.data?.data)) return response.data.data

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
export function isUserVerified(profile: Record<string, any> | null): boolean {
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges) && (badges.includes('verificated') || badges.includes('verified'))) {
    return true
  }

  const flags = profile.flags
  const real = (flags && (flags as any).real) ?? profile.real
  return real === 1 || real === '1' || real === true || real === 'true'
}
