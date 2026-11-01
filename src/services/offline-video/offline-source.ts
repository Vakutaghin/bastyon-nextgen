// Пост → что скачивать и что показать без сети: ссылка на ролик, название,
// автор, описание. Карточка ленты и AdaptedPost подходят оба.

import { mediaTitle } from '@/services/media/media-post'
import { cachedMediaInfo } from '@/services/media/media-info'
import { userAvatar, userName } from '@/services/user-names'
import type { OfflineSource } from './offline-job'

/** Поля поста, нужные для скачанного: карточка ленты и AdaptedPost подходят оба. */
export interface OfflinePostLike {
  type?: string
  videoUrl?: string
  txid?: string
  hash?: string
  id?: string | number
  title?: string
  content?: string
  author?: { address?: string; name?: string; avatar?: string | null }
}

/** Что известно о посте — для показа скачанного без сети. */
export function offlineSourceFromPost(post: OfflinePostLike): OfflineSource | null {
  const url = post.videoUrl
  const kind = post.type === 'video' || post.type === 'audio' ? post.type : null
  if (!kind || !url?.startsWith('peertube://')) return null
  const address = post.author?.address ?? ''
  const avatar = address ? userAvatar(address, post.author?.avatar) : null
  return {
    peertubeUrl: url,
    kind,
    postId: String(post.txid || post.hash || post.id || '') || undefined,
    title: mediaTitle({ title: post.title ?? '', content: post.content ?? '' }),
    description: post.content || undefined,
    author: { address, name: userName(address, post.author?.name), avatarUrl: avatar },
    duration: cachedMediaInfo(url)?.duration ?? undefined,
  }
}
