/**
 * Типы для ответа RPC метода getcomments
 *
 * # getcomments - получение комментариев к посту
 *
 * ## Когда использовать getcomments:
 *
 * ✅ **Используйте для:**
 * - Загрузки всех комментариев к посту
 * - Отображения списка комментариев с профилями авторов
 * - Получения ответов на комментарий (при указании parentId)
 *
 * ## Структура данных:
 *
 * **getcomments** возвращает массив комментариев с полями:
 * - `id` - уникальный идентификатор комментария (txid)
 * - `postid` - ID поста
 * - `address` - адрес автора
 * - `msg` - JSON строка с сообщением (message, url, images, info)
 * - `time`, `timeUpd` - время создания/обновления
 * - `scoreUp`, `scoreDown`, `myScore` - оценки
 * - `children` - количество ответов
 * - `userprofile` - профиль автора комментария
 *
 * ## В старом приложении:
 *
 * - Вызывается через `api.rpc('getcomments', [postId, parentId, address])`
 */

import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Структура сообщения комментария (поле msg в комментарии)
 */
export interface GetCommentMessage {
  message: string
  url: string
  images: string[]
  info: string
}

/**
 * Профиль автора комментария в ответе getcomments
 */
export interface GetCommentUserProfile {
  hash: string
  address: string
  id: number
  name: string
  /** URL аватара */
  i: string
  b?: string
  r?: string
  postcnt?: number
  dltdcnt?: number
  reputation?: number
  subscribes_count?: number
  subscribers_count?: number
  blockings_count?: number
  blockers_count?: number
  likers_count?: number
  k?: string
  a?: string
  l?: string
  s?: string
  update?: number
  regdate?: number
  flags?: Record<string, unknown>
  firstFlags?: Record<string, unknown>
  actions?: number
  bans?: Record<string, unknown>
  badges?: unknown[]
  [key: string]: unknown
}

/**
 * Комментарий из getcomments
 */
export interface GetComment {
  type: number
  id: string
  postid: string
  address: string
  time: number
  timeUpd: number
  block: number
  /** JSON строка с содержимым: {"message":"...","url":"","images":[],"info":""} */
  msg: string
  scoreUp: number
  scoreDown: number
  myScore?: number
  reputation?: number
  children: number
  deleted: boolean
  edit: boolean
  flags: Record<string, unknown>
  userprofile: GetCommentUserProfile
  /** txid корневого (первого) комментария ветки. Пусто для первого уровня. */
  parentid?: string
  /** txid комментария, на который был дан ответ. Пусто для первого уровня. */
  answerid?: string
  /**
   * Локальные статусы транзакции (выставляются клиентом, не приходят из getcomments):
   *   - temp     — TX в mempool, ждёт подтверждения
   *   - relay    — TX отправлена, ждёт релэя
   *   - rejected — TX отклонена сетью
   * См. legacy: components/comments/templates/list.html:33,90-95
   */
  temp?: boolean
  relay?: boolean
  rejected?: boolean
}

/**
 * Полный ответ RPC метода getcomments
 */
export interface GetCommentsResponse extends BaseRpcResponse<GetComment[], StandardRpcTime> {}
