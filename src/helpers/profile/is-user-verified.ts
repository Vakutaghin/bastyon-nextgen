/**
 * «Верифицированный» профиль: бейдж `verificated`/`verified` ИЛИ флаг
 * реальности (`flags.real` / `real` в 1|'1'|true|'true').
 *
 * Единственная реализация в проекте (раньше их было восемь, и две — лента и
 * post-mapper — при `badges: []` не смотрели на `flags.real`, так что один и
 * тот же пользователь был верифицирован в шапке и не верифицирован в ленте).
 */

/** Значения бейджей верификации */
export const VERIFICATION_BADGES = ['verificated', 'verified'] as const

/** Значения флага реальности профиля */
export const VERIFICATION_FLAG_VALUES = [1, '1', true, 'true'] as const

/** Минимальная форма профиля для проверки верификации. */
export interface VerifiableProfile {
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
}

export function isUserVerified(profile: VerifiableProfile | null | undefined): boolean {
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges) && VERIFICATION_BADGES.some((b) => badges.includes(b))) return true

  const flags = profile.flags
  const real = (flags && flags.real) ?? profile.real
  return (VERIFICATION_FLAG_VALUES as readonly unknown[]).includes(real)
}
