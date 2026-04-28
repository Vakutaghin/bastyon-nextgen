/**
 * Извлекает человекочитаемое название поста для отображения в очередях
 * pending-событий (рейтинги, комментарии в шапке). При отсутствии title
 * пробует первый блок content; для видео-постов возвращает «Видео».
 */

interface PostLike {
  title?: string
  content?: string
  type?: string
}

export interface ResolvedPostTitle {
  title: string
  usedContent: boolean
}

export function resolvePostTitleFromPost(post: PostLike | undefined | null): ResolvedPostTitle {
  let postTitle = post?.title || ''
  const usedContent = !postTitle && !!post?.content

  if (usedContent) {
    const content = post!.content!
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        const json = JSON.parse(content)
        if (json?.blocks && Array.isArray(json.blocks) && json.blocks.length > 0) {
          postTitle = json.blocks[0].text || ''
        }
      } catch {
        postTitle = content
      }
    } else {
      postTitle = content
    }
  }

  if (postTitle) {
    try {
      if (/%[0-9A-Fa-f]{2}/.test(postTitle)) {
        postTitle = decodeURIComponent(postTitle)
      }
    } catch {
      // ignore decoding errors
    }
  }

  if (usedContent && postTitle.length > 200) {
    postTitle = postTitle.substring(0, 200) + '...'
  }

  if (!postTitle && post?.type === 'video') {
    postTitle = 'Видео'
  }

  return { title: postTitle, usedContent }
}
