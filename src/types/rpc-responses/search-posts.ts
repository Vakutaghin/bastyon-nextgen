/**
 * Типы для ответа RPC метода `search` при type='posts' (или 'videos').
 *
 * Параметры запроса: [value, 'posts'|'videos', fixedBlock, start, count].
 * Сервер возвращает обёртку вида `{ posts: { data: SearchPost[] } }` — единая
 * для разных типов. Здесь описываем именно ветку `posts`.
 */

/**
 * Пост в результате поиска. Поля совпадают с лентой (см. GetTopFeedPost),
 * но мы помечаем большую часть опциональными — API может прислать неполный
 * объект для поискового сниппета.
 */
export interface SearchPost {
  hash: string
  txid: string
  id?: number
  address: string
  time?: number
  l?: string
  type?: string
  /** caption / заголовок */
  c?: string
  /** message / текст */
  m?: string
  /** URL видео (peertube://) */
  u?: string
  /** теги поста */
  t?: string[]
  /** массив URL изображений */
  i?: string[]
  scoreCnt?: number
  scoreSum?: number
  reposted?: number
  comments?: number
  /** профиль автора (если приходит вместе с постом) */
  userprofile?: Record<string, unknown>
  [key: string]: unknown
}

export interface SearchPostsBucket {
  data: SearchPost[]
  /** опционально — общее количество результатов, если сервер его шлёт */
  count?: number
}

/**
 * data-payload, который мы получаем после unwrapRpcResponse.
 * При type='posts' нас интересует только ветка `posts`.
 */
export interface SearchPostsData {
  posts?: SearchPostsBucket
  [key: string]: unknown
}
