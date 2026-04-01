// Хелперы для адаптации постов: декодирование, нормализация, верификация

import { VERIFICATION_BADGES, VERIFICATION_FLAG_VALUES, RATING_MAX_STARS, RATING_ROUND_MULTIPLIER } from './use-feed-consts'

/**
 * Безопасное декодирование URL-encoded строки.
 * Используется для заголовков, имён авторов, описаний.
 */
export function safeDecode(str: string): string {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

/**
 * Нормализует поле images из различных форматов API в string[].
 * Обрабатывает: строку, массив строк, массив объектов с url.
 */
export function normalizeImages(raw: any): string[] {
  if (!raw) return []
  if (typeof raw === 'string') return raw ? [raw] : []
  if (Array.isArray(raw)) {
    return raw.map((img: any) => (typeof img === 'string' ? img : img?.url || '')).filter(Boolean)
  }
  return []
}

/**
 * Проверяет верификацию пользователя по бейджам и флагам профиля.
 */
export function isUserVerified(profile: Record<string, any> | null): boolean {
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges)) {
    if (VERIFICATION_BADGES.some((b) => badges.includes(b))) return true
  }

  const flags = profile.flags
  const real = (flags && (flags as any).real) ?? profile.real
  return VERIFICATION_FLAG_VALUES.includes(real as any)
}

/**
 * Вычисляет рейтинг в звёздах из суммы/количества оценок.
 */
export function calculateRatingStars(scoreSum: number, scoreCnt: number): number {
  if (!scoreCnt || scoreCnt === 0) return 0
  const avg = scoreSum / scoreCnt
  return Math.max(0, Math.min(RATING_MAX_STARS, Math.round(avg * RATING_ROUND_MULTIPLIER) / RATING_ROUND_MULTIPLIER))
}

/**
 * Извлекает текст сообщения из JSON-строки комментария.
 */
export function extractCommentMessage(msg: string): string {
  if (!msg) return ''
  try {
    const parsed = JSON.parse(msg)
    return parsed?.message ?? msg
  } catch {
    return msg
  }
}
