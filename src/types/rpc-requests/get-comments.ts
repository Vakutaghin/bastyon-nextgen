/**
 * Типы для запроса getcomments API
 *
 * # getcomments - получение комментариев к посту
 *
 * ## Параметры запроса:
 *
 * Параметры передаются как массив с тремя элементами:
 *
 * **Пример использования:**
 * ```typescript
 * // Получить комментарии к посту
 * const request: GetCommentsRequest = {
 *   method: 'getcomments',
 *   parameters: [
 *     '37543692b7e34d915d02532c40f5af1ee6318eded4b6ca2e75604b758d238c96', // postId - ID поста (txid)
 *     '',                                                                   // parentId - ID родительского комментария ('' для всех комментариев)
 *     'PJT8eTrxXD5uCFL2QmRmdDJtCBA1R68Tdf'                                  // address - адрес пользователя (опционально)
 *   ],
 *   options: { auth: false }
 * }
 * ```
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpc('getcomments', [postId, parentId, address])`
 * - Используется для получения комментариев к посту
 * - Может фильтровать по родительскому комментарию и адресу пользователя
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getcomments
 *
 * @param postId - ID поста (txid, хеш транзакции поста)
 * @param parentId - ID родительского комментария ('' для получения всех комментариев, или конкретный ID для получения ответов на комментарий)
 * @param address - Адрес пользователя (опционально, для фильтрации комментариев конкретного пользователя, или '' для всех)
 */
export type GetCommentsParameters = [
  postId: string,
  parentId: string,
  address: string
]

/**
 * Запрос getcomments API
 *
 * Используется для получения комментариев к посту.
 * Не требует авторизации.
 */
export interface GetCommentsRequest extends BaseRpcRequest<GetCommentsParameters> {
  /** Название метода */
  method: 'getcomments'
  /** Параметры запроса */
  parameters: GetCommentsParameters
}
