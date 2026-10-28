// Пост с роликом или треком — в том виде, который нужен разделам «Видео» и
// «Аудио», карточкам плейлистов и очереди проигрывания.

import { safeDecode } from '@/helpers/content/safe-decode'
import { extractPlainTextFromContent } from '@/helpers/content/timecode-parser'
import { userName } from '@/services/user-names'
import type { AdaptedPost } from '@/types/adapted-post'
import type { QueueItem } from '@/stores/playback-queue-store'
import type { MediaInfo } from './media-info'

export type MediaType = 'video' | 'audio'

/** id поста — txid первой публикации, как в коллекциях и ссылках. */
export function postId(post: Pick<AdaptedPost, 'txid' | 'hash' | 'id'>): string {
  return String(post.txid || post.hash || post.id || '')
}

/** Ролик или трек на PeerTube — его можно проиграть. */
export function mediaTypeOf(post: Pick<AdaptedPost, 'type' | 'videoUrl'>): MediaType | null {
  if (!post.videoUrl?.startsWith('peertube://')) return null
  if (post.type === 'video') return 'video'
  if (post.type === 'audio') return 'audio'
  return null
}

/** Заголовок; без него — первая строка текста. */
export function mediaTitle(post: Pick<AdaptedPost, 'title' | 'content'>): string {
  const title = safeDecode(post.title || '').trim()
  if (title) return title
  const text = extractPlainTextFromContent(post.content || '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean)
  return text ? text.slice(0, 120) : ''
}

export function mediaArtist(post: Pick<AdaptedPost, 'author'>): string {
  return userName(post.author?.address, post.author?.name)
}

/** Обложка: превью с PeerTube, а нет его — первая картинка поста. */
export function mediaCover(
  post: Pick<AdaptedPost, 'images'>,
  info?: MediaInfo | null
): string | null {
  return info?.thumbnail || post.images?.[0] || null
}

export function toQueueItem(post: AdaptedPost, info?: MediaInfo | null): QueueItem | null {
  const type = mediaTypeOf(post)
  if (!type || !post.videoUrl) return null
  return {
    id: postId(post),
    type,
    url: post.videoUrl,
    title: mediaTitle(post),
    artist: mediaArtist(post),
    address: post.author?.address ?? '',
    cover: mediaCover(post, info),
    duration: info?.duration ?? null,
  }
}

/** «1:05», «12:40», «1:02:03». */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return ''
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
