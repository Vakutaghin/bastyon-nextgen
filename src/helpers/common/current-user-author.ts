// Автор AdaptedPost для ТЕКУЩЕГО пользователя, собранный из его профиля
// (auth-store). Нужен для оптимистичных (pending) постов, чей автор — всегда сам
// пользователь: лента профиля (use-profile-feed) и превью в шапке
// (header-events / pending-post-preview-modal).

import type { AdaptedPost } from '@/composables/use-feed'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

/** Минимально нужные поля профиля из auth-store (остальное игнорируем). */
export interface CurrentUserProfileLike {
  name?: string
  /** Аватар (ipfs/относительный) — прогоняем через resolveImageUrl. */
  i?: string
  reputation?: number | string
}

/**
 * Строит author-объект AdaptedPost из профиля + адреса. Имя падает на адрес,
 * если профиль ещё не подгружен; letter — первая буква имени/адреса.
 */
export function buildCurrentUserAuthor(
  profile: CurrentUserProfileLike | null | undefined,
  address: string | null | undefined
): AdaptedPost['author'] {
  const addr = address || ''
  const name = profile?.name || '' || addr
  const avatar = profile?.i ? (resolveImageUrl(profile.i) ?? null) : null
  const reputation = profile?.reputation != null ? Number(profile.reputation) || 0 : 0
  return { name, address: addr, avatar, reputation, letter: name ? name[0]! : '?' }
}
