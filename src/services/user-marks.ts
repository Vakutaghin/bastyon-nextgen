/**
 * Значок у аватара по адресу (helpers/profile/user-mark.ts): бейджи — из
 * профиля, пришедшего с данными, иначе из кэша user-names, который догрузит
 * лёгкий профиль незнакомого адреса. Проверенному аккаунту бейджи не нужны.
 */

import { isUserVerified, type VerifiableProfile } from '@/helpers/profile/is-user-verified'
import { userMark, type UserMark } from '@/helpers/profile/user-mark'
import { userBadges } from './user-names'

export function userMarkOf(
  address: string | null | undefined,
  profile?: VerifiableProfile | null
): UserMark | null {
  if (isUserVerified(profile, address)) return 'verified'
  if (Array.isArray(profile?.badges) || !address) return userMark(profile, address)
  return userMark(profile, address, userBadges(address))
}
