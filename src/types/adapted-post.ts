/**
 * Канонический контракт адаптированного поста (формат UI-компонентов ленты,
 * карточки, поиска, встраивания в мессенджер).
 *
 * Единственное место определения: `use-feed.ts` и `post-mapper.ts` только
 * реэкспортируют его. Раньше интерфейс был продублирован в обоих и дрейфовал
 * (аудит крупных файлов 2026-08) — новые поля добавлять ТОЛЬКО здесь.
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
  myVal?: number
  videoUrl?: string
  preview?: string
  /**
   * Язык поста (поле `l`). Нужен при редактировании: без него правка
   * переписывала язык на текущий язык интерфейса (V36).
   */
  language?: string
  /**
   * Настройки поста (поле `s`): `f` — видимость («только подписчикам»),
   * `v`/`version` — маркер статьи. При правке их надо сохранить, иначе пост
   * «только для подписчиков» после исправления опечатки становился публичным
   * (V36).
   */
  settings?: {
    f?: string
    t?: number
    v?: string
    version?: number
    [key: string]: unknown
  }
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
  /** txid оригинальной записи, если это репост */
  repost?: string
  /** Автор оригинальной записи (если есть в ответе API) */
  repostAuthor?: {
    name: string
    address: string
    avatar?: string | null
  }
  /** Время публикации оригинала (unix sec), для отображения даты в блоке репоста */
  repostOriginalTimestamp?: number
  /** Оригинальная запись удалена */
  repostDeleted?: boolean
  /**
   * Оптимистичный пост: транзакция ушла в мемпул, но ещё не подтверждена сетью.
   * Виден только автору в его ленте профиля, рисуется с пометкой «не опубликовано».
   */
  pending?: boolean
}
