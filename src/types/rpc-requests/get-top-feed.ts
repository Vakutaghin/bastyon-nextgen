/**
 * Типы для запроса gettopfeed API
 *
 * # gettopfeed - получение топ-ленты контента
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с следующими элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить топ-ленту (10 постов, русский язык)
 * const request: GetTopFeedRequest = {
 *   method: 'gettopfeed',
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
 *     '',             // пустая строка
 *     10              // depth - глубина выборки
 *   ],
 *   options: { auth: false, ex: true } // Использует rpc-ex эндпоинт
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `psdk.node.shares.gettopfeed(p, callback, cache)`
 * - Параметры: `{ count, lang, height, tagsfilter, tagsexcluded, type, depth, txid }`
 * - Использует rpc-ex эндпоинт (options.ex: true)
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса gettopfeed
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
 * @param _param9 - Пустая строка (резерв)
 * @param depth - Глубина выборки (рекомендуется 10)
 */
export type GetTopFeedParameters = [
  height: number,
  txid: string,
  count: number,
  lang: string,
  tagsfilter: string[],
  type: string[],
  _param6: unknown[],
  _param7: unknown[],
  tagsexcluded: string[],
  _param9: string,
  depth: number
]

/**
 * Запрос gettopfeed API
 *
 * Используется для получения топ-ленты контента с фильтрацией и пагинацией.
 * Использует rpc-ex эндпоинт (options.ex: true).
 */
export interface GetTopFeedRequest extends BaseRpcRequest<GetTopFeedParameters> {
  /** Название метода */
  method: 'gettopfeed'
  /** Параметры запроса */
  parameters: GetTopFeedParameters
  /** Опции запроса - обязательно ex: true для использования rpc-ex */
  options?: {
    ex: true
    auth?: boolean
    cache?: boolean
    [key: string]: unknown
  }
}
