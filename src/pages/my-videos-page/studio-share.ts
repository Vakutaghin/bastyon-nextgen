// Ссылка на ролик для пункта «Копировать ссылку» в меню «Медиастудии».

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { publicPostUrl } from '@/helpers/common/share-origin'
import type { ServerVideo } from './use-server-videos'

export interface VideoShareLink {
  url: string
  /** Пост в Bastyon или страница ролика на видеосервере. */
  kind: 'post' | 'server'
}

/**
 * Есть пост — ссылка на самый свежий: её откроет любой, и под роликом будут
 * текст и комментарии. Поста нет — страница ролика на видеосервере. Пока ролик
 * обрабатывается, чужим её сервер ещё не показывает.
 */
export function videoShareLink(
  video: Pick<ServerVideo, 'posts' | 'pointer' | 'processing'>
): VideoShareLink | null {
  const post = video.posts[0]
  if (post) return { url: publicPostUrl(post.txid), kind: 'post' }
  if (video.processing) return null
  const parsed = parsePeerTubeUrl(video.pointer)
  if (!parsed) return null
  return { url: `https://${parsed.host}/videos/watch/${parsed.videoId}`, kind: 'server' }
}
