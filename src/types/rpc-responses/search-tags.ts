/**
 * Типы для ответа RPC метода `search` при type='tags'.
 *
 * Параметры запроса: [value, 'tags', fixedBlock, start, count].
 * Сервер возвращает `{ tags: { data: SearchTag[] } }`.
 *
 * Названия тегов могут приходить URL-encoded — в старом приложении
 * выполняется `decodeURIComponent(decodeURIComponent(tg.tag))`. Это
 * нормализуем в search-service.
 */

export interface SearchTag {
  /** Имя тега (после декодирования) */
  tag: string
  /** Сколько постов содержат этот тег */
  count: number
}

export interface SearchTagsBucket {
  data: SearchTag[]
  count?: number
}

export interface SearchTagsData {
  tags?: SearchTagsBucket
  [key: string]: unknown
}
