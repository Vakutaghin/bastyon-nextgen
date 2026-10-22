/**
 * Бейджи профиля — выводятся ТОЛЬКО из уже имеющихся данных, без выдуманных порогов:
 *  - `verified` — адрес в списке проверенных, badges (`verificated`/`verified`)
 *    или flags.real (общий `isUserVerified`).
 *  - `moderator`, `shark` — бейджи узла (`badges`), как значки старого
 *    приложения у аватара (корона и флажок).
 *  - `established` — репутация ≥ 100, тот же порог, что уже использует гейтинг оценок
 *    (star-rating-validation.ts: `reputation < 100`).
 */

import { isUserVerified } from '@/helpers/profile/is-user-verified'

export type ProfileBadgeKey = 'verified' | 'moderator' | 'shark' | 'established'

/** Порог «доверенного» аккаунта — синхронизирован со star-rating-validation. */
export const ESTABLISHED_REPUTATION = 100

interface BadgeSource {
  address?: unknown
  reputation?: number | string
  badges?: unknown
  flags?: { real?: unknown; [reason: string]: unknown } | null
  real?: unknown
}

/** Список применимых бейджей профиля (в порядке отображения). */
export function getProfileBadges(profile: BadgeSource | null | undefined): ProfileBadgeKey[] {
  if (!profile) return []
  const badges: ProfileBadgeKey[] = []
  if (isUserVerified(profile)) badges.push('verified')
  const nodeBadges = Array.isArray(profile.badges) ? (profile.badges as unknown[]) : []
  if (nodeBadges.includes('moderator')) badges.push('moderator')
  if (nodeBadges.includes('shark')) badges.push('shark')
  if (Number(profile.reputation ?? 0) >= ESTABLISHED_REPUTATION) badges.push('established')
  return badges
}
