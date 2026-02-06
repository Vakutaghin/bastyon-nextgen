/**
 * Типы для ответа gettags API
 *
 * # gettags - ответ с трендовыми тегами
 *
 * ## Структура ответа:
 *
 * Массив объектов с информацией о тегах.
 *
 * **Пример использования:**
 * ```typescript
 * import { getByPRC } from '@/helpers/api/request'
 *
 * const tags = await getByPRC({
 *   method: 'gettags',
 *   parameters: ['', '100', '12345', 'ru'],
 *   options: { auth: false }
 * }) as GetTagsResponse
 * ```
 */

/**
 * Информация об одном теге
 */
export interface TagInfo {
  /** Название тега */
  tag: string
  /** Количество постов с этим тегом */
  count: number
  /** Позиция в облаке тегов (опционально) */
  positionincloud?: number
  /** Класс для стилизации (опционально) */
  class?: string
  /** Является ли тег новым (опционально) */
  new?: boolean
}

/**
 * Ответ gettags API
 *
 * Массив тегов, отсортированный по популярности.
 */
export type GetTagsResponse = TagInfo[]
