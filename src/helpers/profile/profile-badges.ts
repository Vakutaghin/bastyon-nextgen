/**
 * Бейджи профиля — выводятся ТОЛЬКО из уже имеющихся данных, без выдуманных порогов:
 *  - `verified` — по badges (`verificated`/`verified`) или flags.real
 *    (общий `isUserVerified`).
 *  - `established` — репутация ≥ 100, тот же порог, что уже использует гейтинг оценок
 *    (star-rating-validation.ts: `reputation < 100`).
 */

import { isUserVerified } from '@/helpers/profile/is-user-verified'

export type ProfileBadgeKey = 'verified' | 'established'

/** Порог «доверенного» аккаунта — синхронизирован со star-rating-validation. */
export const ESTABLISHED_REPUTATION = 100

interface BadgeSource {
  reputation?: number | string
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
}

/** Список применимых бейджей профиля (в порядке отображения). */
export function getProfileBadges(profile: BadgeSource | null | undefined): ProfileBadgeKey[] {
  if (!profile) return []
  const badges: ProfileBadgeKey[] = []
  if (isUserVerified(profile)) badges.push('verified')
  if (Number(profile.reputation ?? 0) >= ESTABLISHED_REPUTATION) badges.push('established')
  return badges
}
