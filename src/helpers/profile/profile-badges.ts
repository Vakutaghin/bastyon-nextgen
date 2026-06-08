/**
 * Бейджи профиля — выводятся ТОЛЬКО из уже имеющихся данных, без выдуманных порогов:
 *  - `verified` — по badges (`verificated`/`verified`) или flags.real (та же логика,
 *    что в мессенджере, messenger-store.ts).
 *  - `established` — репутация ≥ 100, тот же порог, что уже использует гейтинг оценок
 *    (star-rating-validation.ts: `reputation < 100`).
 */

export type ProfileBadgeKey = 'verified' | 'established'

/** Порог «доверенного» аккаунта — синхронизирован со star-rating-validation. */
export const ESTABLISHED_REPUTATION = 100

interface BadgeSource {
  reputation?: number | string
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
}

function isVerified(p: BadgeSource): boolean {
  const b = p.badges
  if (Array.isArray(b) && (b.includes('verificated') || b.includes('verified'))) return true
  const real = (p.flags && p.flags.real) ?? p.real
  return real === 1 || real === '1' || real === true || real === 'true'
}

/** Список применимых бейджей профиля (в порядке отображения). */
export function getProfileBadges(profile: BadgeSource | null | undefined): ProfileBadgeKey[] {
  if (!profile) return []
  const badges: ProfileBadgeKey[] = []
  if (isVerified(profile)) badges.push('verified')
  if (Number(profile.reputation ?? 0) >= ESTABLISHED_REPUTATION) badges.push('established')
  return badges
}
