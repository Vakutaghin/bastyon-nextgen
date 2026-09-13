// Хелперы для адаптации постов: декодирование, нормализация, верификация

import { resolveImageUrl } from '@/helpers/common/url-transformer'
import {
  VERIFICATION_BADGES,
  VERIFICATION_FLAG_VALUES,
  RATING_MAX_STARS,
  RATING_ROUND_MULTIPLIER,
} from './use-feed-consts'

/**
 * Безопасное декодирование URL-encoded строки.
 *
 * ВНИМАНИЕ: не используется лентой — там живёт `safeDecode` из `use-feed.ts`,
 * который дополнительно переводит `+` → пробел (form-urlencoded). Какая
 * семантика верна для полей Bastyon (`encodeURIComponent`, где литеральный
 * `+` = `%2B`) — открытый вопрос (аудит крупных файлов 2026-08); до решения
 * два варианта сосуществуют и НЕ должны объединяться вслепую.
 */
export function safeDecode(str: string): string {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

/** Элемент массива изображений в сыром формате API: строка URL или объект с полями url/src. */
type RawImage = string | { url?: string; src?: string } | null | undefined

/**
 * Нормализует поле изображений из сырого ответа API (массив строк, одна строка,
 * массив объектов с url/src) в string[] полных URL: `resolveImageUrl`
 * разворачивает голый хеш в URL и нормализует домен (идемпотентен на полных URL).
 */
export function normalizeImages(raw: unknown): string[] {
  if (!raw) return []
  const list = Array.isArray(raw)
    ? (raw as RawImage[]).map((item) =>
        typeof item === 'string' ? item : (item?.url ?? item?.src ?? '')
      )
    : typeof raw === 'string'
      ? [raw]
      : []
  return list.map((u) => resolveImageUrl(u)).filter((u): u is string => !!u)
}

/** Минимальная форма профиля для проверки верификации. */
interface VerifiableProfile {
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
}

/**
 * Проверяет верификацию пользователя по бейджам и флагам профиля.
 */
export function isUserVerified(profile: VerifiableProfile | null): boolean {
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges)) {
    if (VERIFICATION_BADGES.some((b) => badges.includes(b))) return true
  }

  const flags = profile.flags
  const real = (flags && flags.real) ?? profile.real
  return (VERIFICATION_FLAG_VALUES as readonly unknown[]).includes(real)
}

/**
 * Вычисляет рейтинг в звёздах из суммы/количества оценок.
 */
export function calculateRatingStars(scoreSum: number, scoreCnt: number): number {
  if (!scoreCnt || scoreCnt === 0) return 0
  const avg = scoreSum / scoreCnt
  return Math.max(
    0,
    Math.min(RATING_MAX_STARS, Math.round(avg * RATING_ROUND_MULTIPLIER) / RATING_ROUND_MULTIPLIER)
  )
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
