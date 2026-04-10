/**
 * Маппинг данных поста из API формата в UI формат.
 * Вынесено из feed-store для повторного использования в composables и сторах.
 */

export interface AdaptedPost {
  id: string | number
  hash?: string
  txid?: string
  author: {
    name: string
    address: string
    avatar: string | null
    reputation: number
    letter: string
    verified?: boolean
    subscribers_count?: number
    subscribes_count?: number
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
  videoUrl?: string
  repost?: string
  repostAuthor?: { name: string; address: string }
}

/**
 * Адаптирует данные поста из API в формат компонента
 */
export function adaptPostData(post: any, index: number): AdaptedPost {
  const authorName = post.userprofile?.name || post.address || 'Неизвестный автор'
  const avatar = post.userprofile?.i || null
  const reputation = post.userprofile?.reputation || 0
  const title = post.c || ''
  const content = post.m || ''
  const timestamp = post.time
    ? new Date(post.time * 1000).toISOString()
    : new Date().toISOString()
  const likes = post.scoreCnt || 0
  const comments = post.comments || 0
  const shares = post.reposted || 0
  const tags = Array.isArray(post.t) ? post.t : []
  const images = Array.isArray(post.i) ? post.i : []
  const videoUrl = post.u || post.s?.v || undefined

  let ratingStars = 0
  if (post.scoreCnt > 0 && post.scoreSum !== undefined && post.scoreSum !== null) {
    const averageRating = post.scoreSum / post.scoreCnt
    ratingStars = Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
  }

  const isVerified = Array.isArray(post.userprofile?.badges)
    ? (post.userprofile.badges as any[]).includes('verificated') ||
      (post.userprofile.badges as any[]).includes('verified')
    : (() => {
        const flags = (post.userprofile as any)?.flags
        const real = (flags && (flags as any).real) ?? (post.userprofile as any)?.real
        return real === 1 || real === '1' || real === true || real === 'true'
      })()

  return {
    id: post.id || post.txid || post.hash || index,
    hash: post.hash || post.txid || post.id,
    txid: post.txid || post.hash || post.id,
    author: {
      name: authorName,
      address: post.address || '',
      avatar,
      reputation,
      verified: isVerified,
      letter: authorName.charAt(0).toUpperCase(),
      subscribers_count: post.userprofile?.subscribers_count,
      subscribes_count: post.userprofile?.subscribes_count,
    },
    title,
    content,
    timestamp,
    likes,
    comments,
    shares,
    tags,
    type: post.type || '',
    category: post.type || '',
    images,
    ratingStars,
    scoreCnt: post.scoreCnt || 0,
    scoreSum: post.scoreSum,
    videoUrl,
    repost: post.repost || undefined,
    repostAuthor: undefined,
  }
}

/**
 * Извлекает массив сырых постов из различных форматов ответа API
 */
export function extractRawPosts(feedData: any): any[] {
  if (!feedData) return []
  if (Array.isArray(feedData)) return feedData
  if (feedData.data?.contents && Array.isArray(feedData.data.contents)) return feedData.data.contents
  if (feedData.data && Array.isArray(feedData.data)) return feedData.data
  if (feedData.result && Array.isArray(feedData.result)) return feedData.result
  if (feedData.posts && Array.isArray(feedData.posts)) return feedData.posts
  if (feedData.contents && Array.isArray(feedData.contents)) return feedData.contents
  return []
}
