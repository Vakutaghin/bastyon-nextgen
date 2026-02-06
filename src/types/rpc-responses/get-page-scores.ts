/**
 * Типы для ответа RPC метода getpagescores
 *
 * # getpagescores - получение оценок страницы (комментариев и постов)
 *
 * ## Структура данных:
 *
 * **getpagescores** возвращает массив оценок.
 * Ответ может содержать оценки как для комментариев, так и для постов.
 *
 * Для комментариев:
 * - `cmntid` - ID комментария
 * - `scoreUp` - количество лайков
 * - `scoreDown` - количество дизлайков
 * - `reputation` - репутация комментария
 * - `myScore` - оценка текущего пользователя (0, 1, -1)
 *
 * Для постов:
 * - `posttxid` - ID поста
 * - `value` - оценка текущего пользователя (строка, например "5")
 */

import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Оценка из getpagescores
 *
 * Может представлять оценку комментария или поста.
 */
export interface GetPageScore {
  // Поля для комментариев
  cmntid?: string
  scoreUp?: string | number
  scoreDown?: string | number
  reputation?: string | number
  myScore?: string | number

  // Поля для постов
  posttxid?: string
  value?: string | number
}

/**
 * Полный ответ RPC метода getpagescores
 */
export interface GetPageScoresResponse extends BaseRpcResponse<GetPageScore[], StandardRpcTime> {}
