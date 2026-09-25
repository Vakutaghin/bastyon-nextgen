// Хелперы для адаптации постов: декодирование, нормализация, верификация

import { resolveImageUrl } from '@/helpers/common/url-transformer'

// Декодер и проверка верификации — канонические реализации в helpers;
// здесь только реэкспорт для потребителей composables-барреля.
export { safeDecode } from '@/helpers/content/safe-decode'
export { isUserVerified } from '@/helpers/profile/is-user-verified'

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
