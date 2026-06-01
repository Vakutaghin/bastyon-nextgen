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

/** Минимальный профиль автора в сыром посте. */
interface RawUserProfile {
  name?: string
  i?: string
  reputation?: number
  badges?: unknown
  flags?: { real?: unknown } | null
  real?: unknown
  subscribers_count?: number
  subscribes_count?: number
}

/**
 * Сырой пост из ответа RPC-ленты (gettopfeed / gethierarchicalstrip / getprofilefeed).
 * Описывает только поля, к которым обращается адаптер.
 */
interface RawFeedPost {
  id?: string | number
  txid?: string
  hash?: string
  address?: string
  userprofile?: RawUserProfile
  c?: string
  m?: string
  time?: number
  scoreCnt?: number
  scoreSum?: number
  comments?: number
  reposted?: number
  t?: string[]
  i?: string[]
  u?: string
  s?: { v?: string }
  type?: string
  repost?: string
}

/**
 * Адаптирует данные поста из API в формат компонента
 */
export function adaptPostData(post: RawFeedPost, index: number): AdaptedPost {
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

  // hash/txid — строковые идентификаторы; числовой post.id используется как запасной вариант.
  const idAsString = post.id != null ? String(post.id) : undefined

  let ratingStars = 0
  const scoreCnt = post.scoreCnt ?? 0
  if (scoreCnt > 0 && post.scoreSum !== undefined && post.scoreSum !== null) {
    const averageRating = post.scoreSum / scoreCnt
    ratingStars = Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
  }

  const isVerified = Array.isArray(post.userprofile?.badges)
    ? post.userprofile.badges.includes('verificated') ||
      post.userprofile.badges.includes('verified')
    : (() => {
        const flags = post.userprofile?.flags
        const real = (flags && flags.real) ?? post.userprofile?.real
        return real === 1 || real === '1' || real === true || real === 'true'
      })()

  return {
    id: post.id || post.txid || post.hash || index,
    hash: post.hash || post.txid || idAsString,
    txid: post.txid || post.hash || idAsString,
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

/** Возможные формы ответа ленты, из которых извлекаются сырые посты. */
interface RawFeedResponse {
  data?: { contents?: RawFeedPost[] } | RawFeedPost[]
  result?: RawFeedPost[]
  posts?: RawFeedPost[]
  contents?: RawFeedPost[]
  /** Прочие поля разных форматов ответа API игнорируются. */
  [key: string]: unknown
}

/**
 * Извлекает массив сырых постов из различных форматов ответа API
 */
export function extractRawPosts(feedData: RawFeedResponse | RawFeedPost[] | null | undefined): RawFeedPost[] {
  if (!feedData) return []
  if (Array.isArray(feedData)) return feedData
  const data = feedData.data
  if (data && !Array.isArray(data) && Array.isArray(data.contents)) return data.contents
  if (Array.isArray(data)) return data
  if (Array.isArray(feedData.result)) return feedData.result
  if (Array.isArray(feedData.posts)) return feedData.posts
  if (Array.isArray(feedData.contents)) return feedData.contents
  return []
}
