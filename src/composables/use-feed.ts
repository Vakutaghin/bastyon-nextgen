/**
 * Типы и хелперы для работы с лентой постов
 *
 * Основные composables находятся в use-feed-queries.ts
 */

import type { GetHierarchicalStripResponse } from '@/types/rpc-responses/get-hierarchical-strip'
import type { GetTopFeedResponse } from '@/types/rpc-responses/get-top-feed'
import type { GetProfileFeedResponse } from '@/types/rpc-responses/get-profile-feed'

/**
 * Интерфейс адаптированного поста
 */
export interface AdaptedPost {
  id: string | number
  hash?: string // Хеш поста (share ID для upvote)
  txid?: string // ID транзакции (альтернатива hash)
  author: {
    name: string
    address: string
    avatar: string | null
    reputation: number
    letter: string
    verified?: boolean
  }
  title: string
  content: string
  timestamp: string
  likes: number
  comments: number
  shares: number
  tags: string[]
  type: string
  category: string
  images: string[]
  ratingStars: number
  scoreCnt: number
  scoreSum?: number
  myVal?: number
  videoUrl?: string
  preview?: string
  lastComment?: {
    id: string
    address: string
    authorName: string
    avatar: string | null
    time: number
    message: string
    children: number
    scoreUp: number
    scoreDown: number
  }
}

/**
 * Безопасное декодирование URL-encoded строк
 */
function safeDecode(str: string): string {
  try {
    return decodeURIComponent((str + '').replace(/\+/g, '%20'))
  } catch (e) {
    return str
  }
}

/**
 * Адаптирует данные поста из API в формат компонента
 */
export function adaptPostData(post: any, index: number, usersMap: Record<string, any> = {}): AdaptedPost {
  let userprofile = post.userprofile

  // Если профиля нет в посте, пробуем найти его в карте пользователей по адресу
  if (!userprofile && post.address && usersMap[post.address]) {
    userprofile = usersMap[post.address]
  }

  const authorName = userprofile?.name ||
                    post.address ||
                    'Неизвестный автор'

  const avatar = userprofile?.i || null
  const reputation = userprofile?.reputation || 0
  const verified =
        Array.isArray(userprofile?.badges)
          ? (userprofile.badges as any[]).includes('verificated') ||
            (userprofile.badges as any[]).includes('verified')
          : (() => {
              const flags = (userprofile as any)?.flags
              const real = (flags && (flags as any).real) ?? (userprofile as any)?.real
              return real === 1 || real === '1' || real === true || real === 'true'
            })()
  const title = safeDecode(post.c || '')
  const content = safeDecode(post.m || '')
  const timestamp = post.time
    ? new Date(post.time * 1000).toISOString()
    : new Date().toISOString()
  const likes = post.scoreCnt || 0
  const comments = post.comments || 0
  const shares = post.reposted || 0
  const tags = Array.isArray(post.t) ? post.t : []
  const images = Array.isArray(post.i) ? post.i : []
  const videoUrl = post.u || post.s?.v || undefined
  const myVal = post.myVal
  const preview = safeDecode(post.preview || post.p || '')

  let ratingStars = 0
  if (post.scoreCnt > 0 && post.scoreSum !== undefined && post.scoreSum !== null) {
    const averageRating = post.scoreSum / post.scoreCnt
    ratingStars = Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
  }

  let lastComment
  if (post.lastComment && post.lastComment.msg) {
    let msg = ''
    try {
      const parsed = JSON.parse(post.lastComment.msg)
      msg = safeDecode(parsed?.message || '')
    } catch {
      msg = safeDecode(String(post.lastComment.msg || ''))
    }

    const commenterProfile = usersMap[post.lastComment.address] || null
    const commenterName = commenterProfile?.name || post.lastComment.address || ''
    const commenterAvatar = commenterProfile?.i || null

    lastComment = {
      id: String(post.lastComment.id || ''),
      address: String(post.lastComment.address || ''),
      authorName: String(commenterName || ''),
      avatar: commenterAvatar || null,
      time: Number(post.lastComment.time || 0),
      message: msg,
      children: Number(post.lastComment.children || 0),
      scoreUp: Number(post.lastComment.scoreUp || 0),
      scoreDown: Number(post.lastComment.scoreDown || 0)
    }
  }

  return {
    id: post.id || post.txid || post.hash || index,
    hash: post.hash || post.txid || post.id,
    txid: post.txid || post.hash || post.id,
    author: {
      name: authorName,
      address: post.address || '',
      avatar: avatar,
      reputation: reputation,
      letter: authorName.charAt(0).toUpperCase(),
      verified
    },
    title: title,
    content: content,
    timestamp: timestamp,
    likes: likes,
    comments: comments,
    shares: shares,
    tags: tags,
    type: post.type || '',
    category: post.type || '',
    images: images,
    ratingStars: ratingStars,
    scoreCnt: post.scoreCnt || 0,
    scoreSum: post.scoreSum,
    myVal: myVal,
    videoUrl: videoUrl,
    preview: preview,
    lastComment
  }
}

/**
 * Преобразует данные API в массив адаптированных постов
 */
export function extractPostsFromResponse(
  feedData: GetTopFeedResponse | GetHierarchicalStripResponse | GetProfileFeedResponse | null | undefined
): AdaptedPost[] {
  if (!feedData) {
    return []
  }

  let rawPosts: any[] = []
  const usersMap: Record<string, any> = {}

  // Обработка users из data.users (gethierarchicalstrip, gettopfeed)
  if (feedData.data && (feedData.data as any).users && Array.isArray((feedData.data as any).users)) {
    (feedData.data as any).users.forEach((u: any) => {
      if (u.address) {
        usersMap[u.address] = u
      }
    })
  }

  // API может возвращать данные в разных форматах
  if (Array.isArray(feedData)) {
    rawPosts = feedData
  } else if (feedData.data && feedData.data.contents && Array.isArray(feedData.data.contents)) {
    // getprofilefeed может возвращать смешанный контент (посты + профили)
    const contents = feedData.data.contents

    // Разделяем посты и профили
    rawPosts = contents.filter((item: any) => {
      // Если есть поле 'name' и нет 'txid', это профиль пользователя
      // (согласно документации getprofilefeed)
      if (item.name && !item.txid && !item.type) {
        if (item.address) {
          usersMap[item.address] = item
        }
        return false // Не включаем в посты
      }
      return true // Это пост
    })
  } else if (feedData.data && Array.isArray(feedData.data)) {
    rawPosts = feedData.data
  } else if (feedData.result && Array.isArray(feedData.result)) {
    rawPosts = feedData.result
  } else if ((feedData as any).posts && Array.isArray((feedData as any).posts)) {
    rawPosts = (feedData as any).posts
  } else if ((feedData as any).contents && Array.isArray((feedData as any).contents)) {
    rawPosts = (feedData as any).contents
  } else {
    return []
  }

  return rawPosts.map((post, index) => adaptPostData(post, index, usersMap))
}

/**
 * @deprecated Используйте useHierarchicalStrip из use-feed-queries.ts
 * Оставлено для обратной совместимости
 */
export { useHierarchicalStrip, useTopFeed } from './use-feed-queries'
