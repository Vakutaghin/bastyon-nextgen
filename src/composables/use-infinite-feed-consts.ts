// Константы для composable бесконечной ленты

/** ID вкладок фильтров */
export const TAB_IDS = {
  /** Подписки */
  SUBSCRIPTIONS: 2,
  /** Видео */
  VIDEO: 3,
  /** Аудио */
  AUDIO: 4,
  /** Статьи */
  ARTICLES: 5,
  /** Избранное */
  FAVORITES: 6,
  /** Обсуждаемое (самое комментируемое) */
  MOST_COMMENTED: 7,
} as const

/** Типы контента для API */
export const CONTENT_TYPE_BY_TAB: Partial<Record<number, string>> = {
  [TAB_IDS.VIDEO]: 'video',
  [TAB_IDS.AUDIO]: 'audio',
  [TAB_IDS.ARTICLES]: 'article',
}

/** Окно «обсуждаемого» в минутах (24 часа) */
export const MOST_COMMENTED_WINDOW_MINUTES = 1440

/** Множитель безопасного расстояния по умолчанию (1 viewport height) */
export const DEFAULT_THRESHOLD_PX = typeof window !== 'undefined' ? window.innerHeight : 1000
