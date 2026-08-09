// Канонические типы карточки поста (source of truth). Вынесено из post-card.vue
// (см. LARGE_FILE_SPLIT_AUDIT.md).

export interface PostAuthor {
  name: string
  address: string
  avatar?: string | null
  reputation: number
  letter: string
  verified?: boolean
  subscribers_count?: number
  subscribes_count?: number
}

export interface Post {
  id?: string | number
  /** Хеш поста (share ID для upvote). */
  hash?: string
  /** ID транзакции (альтернатива hash). */
  txid?: string
  author: PostAuthor
  title?: string
  content?: string
  timestamp: string
  likes?: number
  comments?: number
  shares?: number
  tags?: string[]
  type?: string
  category?: string
  images?: string[]
  ratingStars?: number
  scoreCnt?: number
  scoreSum?: number
  /** Оценка текущего пользователя. */
  myVal?: number
  /** URL видео в формате peertube://host/videoid. */
  videoUrl?: string
  /** Текст превью для статей. */
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
  /** txid оригинальной записи (если репост). */
  repost?: string
  /** Автор оригинальной записи. */
  repostAuthor?: {
    name: string
    address: string
    avatar?: string | null
  }
  /** Время публикации оригинала (unix sec). */
  repostOriginalTimestamp?: number
  /** Оригинал удалён. */
  repostDeleted?: boolean
}
