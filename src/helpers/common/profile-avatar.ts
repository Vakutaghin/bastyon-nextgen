// Извлечение URL аватара из объекта профиля.
// Унифицирует разрозненные fallback'и из header-user/account-switcher/chat-room
// и нормализует URL через resolveImageUrl.

import { resolveImageUrl } from './url-transformer'

/** Поля профиля, в которых может лежать ссылка на аватар (упорядочены по приоритету). */
const AVATAR_FIELDS = ['i', 'avatar', 'image', 'img', 'avatarUrl', 'avatar_url'] as const

/**
 * Достаёт URL аватара из произвольного профиля.
 * Перебирает известные имена полей (i / avatar / image / img / avatarUrl / avatar_url),
 * пропускает результат через resolveImageUrl (нормализация домена + достройка от хэша).
 *
 * @returns полный нормализованный URL или undefined, если ни одно поле не дало ссылку.
 */
export function extractAvatarFromProfile(profile: unknown): string | undefined {
  if (!profile || typeof profile !== 'object') return undefined
  const p = profile as Record<string, unknown>
  for (const field of AVATAR_FIELDS) {
    const value = p[field]
    if (typeof value === 'string' && value.length > 0) {
      return resolveImageUrl(value)
    }
  }
  return undefined
}
