// Ссылка на ролик для пунктов «Копировать ссылку» и «Отправить в чат» в меню «Медиастудии».

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { chatLinks, publicPostUrl } from '@/helpers/common/share-origin'
import type { ServerVideo } from './use-server-videos'

export interface VideoShareLink {
  url: string
  /** Для чата Bastyon: пост — в формате bastyon.com, там он станет карточкой. */
  chatUrl: string
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
  if (post)
    return { url: publicPostUrl(post.txid), chatUrl: chatLinks.post(post.txid), kind: 'post' }
  if (video.processing) return null
  const parsed = parsePeerTubeUrl(video.pointer)
  if (!parsed) return null
  const url = `https://${parsed.host}/videos/watch/${parsed.videoId}`
  return { url, chatUrl: url, kind: 'server' }
}
