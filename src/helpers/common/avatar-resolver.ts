// Резолв URL аватара пользователя с учётом множественных источников данных

import { resolveImageUrl } from './url-transformer'

/**
 * Поля профиля, в которых может храниться аватар.
 * API использует сокращённые имена полей — порядок определяет приоритет.
 */
const AVATAR_FIELDS = ['i', 'avatar', 'image', 'img', 'avatarUrl', 'avatar_url'] as const

/**
 * Извлекает URL аватара из профиля пользователя.
 * Проверяет несколько полей (accSet.image, i, avatar, image, ...)
 * с нормализацией домена через resolveImageUrl.
 *
 * @param profile - объект профиля из RPC-ответа
 * @returns полный URL аватара или undefined
 */
export function resolveAvatarUrl(profile: Record<string, any> | null | undefined): string | undefined {
  if (!profile) return undefined

  // Приоритетный источник — настройки аккаунта
  if (profile.accSet?.image) {
    return resolveImageUrl(profile.accSet.image)
  }

  // Перебираем известные поля профиля
  for (const field of AVATAR_FIELDS) {
    const value = profile[field]

    if (value && typeof value === 'string') {
      return resolveImageUrl(value)
    }
  }

  return undefined
}
