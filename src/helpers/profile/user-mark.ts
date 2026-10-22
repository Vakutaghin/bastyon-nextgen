/**
 * Значок у аватара — как `markUser` старого приложения (pocketnet.gui,
 * satolist.js): один, по старшинству — проверенный аккаунт (галочка),
 * модератор (корона), «акула» (флажок). Модератора и «акулу» присылает узел в
 * `badges`, проверенный — по списку адресов (is-user-verified.ts). Значок
 * `dev` старого приложения узел не присылает — его нет и здесь.
 */

import { isUserVerified, type VerifiableProfile } from './is-user-verified'

export type UserMark = 'verified' | 'moderator' | 'shark'

/** Бейджи узла, дающие значок, — в порядке старшинства. */
const BADGE_MARKS = ['moderator', 'shark'] as const

/**
 * @param address - адрес, если он известен отдельно от профиля
 * @param knownBadges - бейджи из кэша профилей, когда в `profile` их нет
 */
export function userMark(
  profile: VerifiableProfile | null | undefined,
  address?: string | null,
  knownBadges?: readonly unknown[] | null
): UserMark | null {
  if (isUserVerified(profile, address)) return 'verified'
  const badges = Array.isArray(profile?.badges) ? (profile.badges as unknown[]) : knownBadges
  if (!badges) return null
  return BADGE_MARKS.find((b) => badges.includes(b)) ?? null
}
