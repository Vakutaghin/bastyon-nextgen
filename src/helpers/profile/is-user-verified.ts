/**
 * «Проверенный» аккаунт — галочка у аватара. Главный признак — адрес в списке
 * проверенных (verified-addresses.ts, как `platform.real` старого приложения):
 * узел сам такого признака не отдаёт. Бейдж `verificated`/`verified` и флаг
 * `real` (1|'1'|true|'true') тоже засчитываются — на случай, если узел их
 * когда-нибудь пришлёт.
 *
 * Единственная реализация в проекте (раньше их было восемь, и две — лента и
 * post-mapper — при `badges: []` не смотрели на `flags.real`, так что один и
 * тот же пользователь был верифицирован в шапке и не верифицирован в ленте).
 */

import { VERIFIED_ADDRESSES } from './verified-addresses'

/** Значения бейджей верификации */
export const VERIFICATION_BADGES = ['verificated', 'verified'] as const

/** Значения флага реальности профиля */
export const VERIFICATION_FLAG_VALUES = [1, '1', true, 'true'] as const

/** Минимальная форма профиля для проверки верификации. */
export interface VerifiableProfile {
  address?: unknown
  badges?: unknown
  /** У узла `flags` — счётчики жалоб по причинам (`{ 3: 1 }`), `real` в них нет. */
  flags?: { real?: unknown; [reason: string]: unknown } | null
  real?: unknown
}

/** Адрес — в списке проверенных аккаунтов. */
export function isAddressVerified(address: unknown): boolean {
  return typeof address === 'string' && VERIFIED_ADDRESSES.has(address)
}

/**
 * @param address - адрес, если он известен отдельно от профиля (профиль ещё
 *   не загружен или пришёл без поля `address`)
 */
export function isUserVerified(
  profile: VerifiableProfile | null | undefined,
  address?: string | null
): boolean {
  if (isAddressVerified(address) || isAddressVerified(profile?.address)) return true
  if (!profile) return false

  const badges = profile.badges
  if (Array.isArray(badges) && VERIFICATION_BADGES.some((b) => badges.includes(b))) return true

  const flags = profile.flags
  const real = (flags && flags.real) ?? profile.real
  return (VERIFICATION_FLAG_VALUES as readonly unknown[]).includes(real)
}
