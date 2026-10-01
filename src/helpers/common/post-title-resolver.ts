/**
 * Извлекает человекочитаемое название поста для отображения в очередях
 * pending-событий (рейтинги, комментарии в шапке). При отсутствии title
 * пробует первый блок content; для видео-постов возвращает «Видео».
 */

import { safeDecode } from '@/helpers/content/safe-decode'
import { t } from '@/i18n'

/** Пост в любом виде: из ленты (поля — строки) или из posts-store (поля — unknown). */
interface PostLike {
  title?: unknown
  content?: unknown
  type?: unknown
  [key: string]: unknown
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export interface ResolvedPostTitle {
  title: string
  usedContent: boolean
}

export function resolvePostTitleFromPost(post: PostLike | undefined | null): ResolvedPostTitle {
  let postTitle = text(post?.title)
  const content = text(post?.content)
  const usedContent = !postTitle && !!content

  if (usedContent) {
    if (content.trim().startsWith('{')) {
      try {
        const json = JSON.parse(content)
        if (json?.blocks && Array.isArray(json.blocks) && json.blocks.length > 0) {
          // Editor.js держит текст в `data.text`; `blocks[0].text` не существует,
          // из-за чего статьи в «песочных часах» были «без названия» (N13).
          const first = json.blocks[0]
          postTitle = first?.data?.text || first?.data?.caption || first?.text || ''
        }
      } catch {
        postTitle = content
      }
    } else {
      postTitle = content
    }
  }

  if (postTitle) postTitle = safeDecode(postTitle)

  if (usedContent && postTitle.length > 200) {
    postTitle = postTitle.substring(0, 200) + '...'
  }

  if (!postTitle && post?.type === 'video') {
    postTitle = t('postCard.videoTitle')
  }

  return { title: postTitle, usedContent }
}
