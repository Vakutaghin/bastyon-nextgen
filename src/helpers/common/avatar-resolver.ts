// Резолв URL аватара пользователя с учётом множественных источников данных

import { resolveImageUrl } from './url-transformer'

/**
 * Поля профиля, в которых может храниться аватар.
 * API использует сокращённые имена полей — порядок определяет приоритет.
 */
const AVATAR_FIELDS = ['i', 'avatar', 'image', 'img', 'avatarUrl', 'avatar_url'] as const

interface AvatarProfile {
  accSet?: { image?: string }
  [field: string]: unknown
}

/**
 * Извлекает URL аватара из профиля пользователя. Реализация одна на всё
 * приложение: раньше рядом жила копия, которая не смотрела accSet (N36).
 * Проверяет несколько полей (accSet.image, i, avatar, image, ...)
 * с нормализацией домена через resolveImageUrl.
 *
 * @param input - объект профиля из RPC-ответа (любой формы)
 * @returns полный URL аватара или undefined
 */
export function resolveAvatarUrl(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const profile = input as AvatarProfile

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
