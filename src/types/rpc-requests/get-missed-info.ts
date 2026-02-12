/**
 * Типы для запроса getmissedinfo API
 *
 * # getmissedinfo - получение пропущенной информации (блоки + события/уведомления)
 *
 * В старом приложении (satolist.js):
 *   platform.sdk.missed.get(block) ->
 *   api.rpc('getmissedinfo', [address, block, 30])
 *
 * Параметры:
 * 1) address — адрес пользователя (для которого запрашиваем пропущенные события)
 * 2) block — высота блока, начиная с которой возвращать данные (0 = с начала)
 * 3) limit — максимальное количество элементов (в старом приложении передаётся 30)
 *
 * Ответ: массив, где data[0] — сводка по блоку (block, cntposts, contentsLang),
 * data[1..] — события/уведомления (upvoteShare, subscribe, answer и т.д.).
 */

import type { BaseRpcRequest } from './common'

/**
 * Параметры запроса getmissedinfo
 *
 * [0] address — адрес пользователя (string)
 * [1] block — высота блока (number), с которого запрашивать пропущенные данные
 * [2] limit — макс. количество элементов в ответе (number), например 30
 */
export type GetMissedInfoParameters = [address: string, block: number, limit: number]

/**
 * Запрос getmissedinfo API
 *
 * Используется для синхронизации контента и уведомлений после перерыва.
 * Требует авторизации (подпись с адресом пользователя).
 */
export interface GetMissedInfoRequest extends BaseRpcRequest<GetMissedInfoParameters> {
  method: 'getmissedinfo'
  parameters: GetMissedInfoParameters
}
