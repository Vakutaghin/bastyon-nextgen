// Автор канала для строки списка и шапки: профиль из кэша мессенджера, пока
// его нет — имя и аватар из последней ленты канала, в крайнем случае адрес.

import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { isUserVerified, type VerifiableProfile } from '@/helpers/profile/is-user-verified'
import { userMark, type UserMark } from '@/helpers/profile/user-mark'

type ProfileLike = VerifiableProfile & {
  name?: string
  i?: string
  avatar?: string
  image?: string
}

export interface ChannelAuthor {
  name: string
  avatar?: string
  verified: boolean
  mark: UserMark | null
}

export function channelAuthor(
  address: string,
  profile: unknown,
  fallback?: { name?: string; avatar?: string | null }
): ChannelAuthor {
  const p = profile as ProfileLike | undefined
  const image = p?.i || p?.avatar || p?.image
  const avatar = (image ? resolveImageUrl(image) : undefined) || fallback?.avatar || undefined
  return {
    name: p?.name || fallback?.name || address,
    avatar,
    verified: isUserVerified(p, address),
    mark: userMark(p, address),
  }
}
