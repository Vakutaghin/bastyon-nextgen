/**
 * Типы для запроса getprofilefeed API
 *
 * # getprofilefeed - получение ленты профиля пользователя
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с следующими элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить ленту профиля пользователя
 * const request: GetProfileFeedRequest = {
 *   method: 'getprofilefeed',
 *   parameters: [
 *     0,              // height - высота блока (0 = последние)
 *     '',             // txid - ID транзакции для пагинации ('' = с начала)
 *     10,             // count - количество постов
 *     'ru',           // lang - язык контента
 *     [],             // tagsfilter - фильтр по тегам
 *     [],             // type - тип контента
 *     [],             // пустой параметр
 *     [],             // пустой параметр
 *     [],             // tagsexcluded - исключенные теги
 *     'PJT8eTrx...',  // address - адрес пользователя
 *     '',             // keyword - ключевое слово для поиска (опционально)
 *     '',             // orderby - сортировка (опционально)
 *     'desc'          // ascdesc - направление сортировки (asc/desc)
 *   ],
 *   options: { auth: false, ex: true } // Использует rpc-ex эндпоинт
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `psdk.node.shares.hierarchical(p, callback, cache, { method: 'getprofilefeed' })`
 * - Параметры: `{ count, lang, height, tagsfilter, tagsexcluded, type, txid, address, keyword, orderby, ascdesc }`
 * - Использует rpc-ex эндпоинт (options.ex: true)
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getprofilefeed
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
 * @param _param9 - Пустой параметр (резерв)
 * @param address - Адрес пользователя, чью ленту получаем
 * @param keyword - Ключевое слово для поиска (опционально, '' = без поиска)
 * @param orderby - Поле для сортировки (опционально, '' = по умолчанию)
 * @param ascdesc - Направление сортировки ('asc' или 'desc')
 */
export type GetProfileFeedParameters = [
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
  address: string,
  keyword: string,
  orderby: string,
  ascdesc: 'asc' | 'desc'
]

/**
 * Запрос getprofilefeed API
 *
 * Используется для получения ленты конкретного пользователя с фильтрацией и пагинацией.
 * Использует rpc-ex эндпоинт (options.ex: true).
 */
export interface GetProfileFeedRequest extends BaseRpcRequest<GetProfileFeedParameters> {
  /** Название метода */
  method: 'getprofilefeed'
  /** Параметры запроса */
  parameters: GetProfileFeedParameters
  /** Опции запроса - обязательно ex: true для использования rpc-ex */
  options?: {
    ex: true
    auth?: boolean
    cache?: boolean
    [key: string]: unknown
  }
}
