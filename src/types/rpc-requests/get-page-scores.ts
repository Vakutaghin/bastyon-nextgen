/**
 * Типы для запроса getpagescores API
 *
 * # getpagescores - получение оценок страницы (комментариев и постов)
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с тремя элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить оценки постов и комментариев
 * const request: GetPageScoresRequest = {
 *   method: 'getpagescores',
 *   parameters: [
 *     ['postTxId1', 'postTxId2'],            // postIds - массив ID постов
 *     'PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf', // address - адрес пользователя
 *     [                                      // commentIds - массив ID комментариев
 *       '415a9e3392172df0d498a462e3b72dbd53afa63da67ef42cb0882c6b013d3e5f'
 *     ]
 *   ],
 *   options: { auth: false }
 * }
 * ```
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getpagescores
 *
 * @param postIds - Массив ID постов (хеши транзакций)
 * @param address - Адрес пользователя (Pocketnet адрес)
 * @param commentIds - Массив ID комментариев (хеши транзакций)
 */
export type GetPageScoresParameters = [
  postIds: string[],
  address: string,
  commentIds: string[]
]

/**
 * Запрос getpagescores API
 *
 * Используется для получения оценок комментариев и постов.
 */
export interface GetPageScoresRequest extends BaseRpcRequest<GetPageScoresParameters> {
  /** Название метода */
  method: 'getpagescores'
  /** Параметры запроса */
  parameters: GetPageScoresParameters
}
