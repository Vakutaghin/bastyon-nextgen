/**
 * Типы для запроса getcomments API
 *
 * # getcomments - получение комментариев к посту
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getcomments
 *
 * @param postId - ID поста (txid, хеш транзакции поста)
 * @param parentId - ID родительского комментария ('' для всех комментариев, или ID для ответов на комментарий)
 * @param address - Адрес пользователя-контекста: при указании в ответе для каждого комментария заполняется myScore (оценка этого пользователя — лайк/дизлайк); '' — без контекста
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
