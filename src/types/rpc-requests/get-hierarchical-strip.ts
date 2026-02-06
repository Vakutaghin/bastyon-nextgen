/**
 * Типы для запроса gethierarchicalstrip API
 *
 * # gethierarchicalstrip - получение иерархической ленты контента
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с следующими элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить иерархическую ленту (10 постов, русский язык)
 * const request: GetHierarchicalStripRequest = {
 *   method: 'gethierarchicalstrip',
 *   parameters: [
 *     0,              // height - высота блока (0 = последние)
 *     '',             // txid - ID транзакции для пагинации ('' = с начала)
 *     10,             // count - количество постов
 *     'ru',           // lang - язык контента
 *     [],             // tagsfilter - фильтр по тегам ([] = все теги)
 *     [],             // type - тип контента ([] = все типы)
 *     [],             // пустой параметр
 *     [],             // пустой параметр
 *     [],             // tagsexcluded - исключенные теги
 *     '',             // пустая строка (для author, если нужен)
 *     ''              // пустая строка (дополнительный параметр)
 *   ],
 *   options: { auth: false, ex: true } // Использует rpc-ex эндпоинт
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `psdk.node.shares.hierarchical(p, callback, cache)`
 * - Параметры: `{ count, lang, height, tagsfilter, tagsexcluded, type, txid }`
 * - Использует rpc-ex эндпоинт (options.ex: true)
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса gethierarchicalstrip
 *
 * @param height - Высота блока (0 = последние посты)
 * @param txid - ID транзакции для пагинации ('' = с начала)
 * @param count - Количество постов в ответе
 * @param lang - Язык контента ('ru', 'en', '' = все языки)
 * @param tagsfilter - Фильтр по тегам ([] = все теги)
 * @param type - Тип контента ([] = все типы)
 * @param _param6 - Пустой параметр (резерв)
 * @param _param7 - Пустой параметр (резерв)
 * @param tagsexcluded - Исключенные теги
 * @param author - Адрес автора (опционально, '' = все авторы)
 * @param _param10 - Пустая строка (резерв)
 */
export type GetHierarchicalStripParameters = [
  height: number,
  txid: string,
  count: number,
  lang: string,
  tagsfilter: string[],
  type: string[],
  _param6: unknown[],
  _param7: unknown[],
  tagsexcluded: string[],
  author: string,
  _param10: string
]

/**
 * Запрос gethierarchicalstrip API
 *
 * Используется для получения иерархической ленты контента с фильтрацией и пагинацией.
 * Использует rpc-ex эндпоинт (options.ex: true).
 */
export interface GetHierarchicalStripRequest extends BaseRpcRequest<GetHierarchicalStripParameters> {
  /** Название метода */
  method: 'gethierarchicalstrip'
  /** Параметры запроса */
  parameters: GetHierarchicalStripParameters
  /** Опции запроса - обязательно ex: true для использования rpc-ex */
  options?: {
    ex: true
    auth?: boolean
    cache?: boolean
    [key: string]: unknown
  }
}
