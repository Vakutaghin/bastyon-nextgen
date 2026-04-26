/**
 * Типы для запроса sendrawtransactionwithmessage API
 *
 * # sendrawtransactionwithmessage - отправка подписанной транзакции с телом сообщения
 *
 * Используется для: комментариев (comment), оценок комментариев (cScore), апвоутов (upvoteShare) и др.
 */

import type { BaseRpcRequest } from './common'

/**
 * Внутреннее тело сообщения комментария (поле msg в CommentMessagePayload).
 * Сериализуется в JSON-строку.
 */
export interface CommentMessageBody {
  message: string
  url: string
  images: string[]
  info: string
}

/**
 * Тело сообщения для типа "comment" / "commentEdit" / "commentDelete" во втором параметре RPC.
 *
 * Для:
 *   - "comment"        — поле id отсутствует; msg обязателен.
 *   - "commentEdit"    — поле id = txid редактируемого комментария; msg обязателен.
 *   - "commentDelete"  — поле id = txid удаляемого комментария; msg отсутствует (по legacy: kit.js:481-504).
 */
export interface CommentMessagePayload {
  /** ID поста (txid поста) */
  postid: string
  /** ID комментария, на который отвечаем (пусто для комментария к посту) */
  answerid: string
  /** ID родительского комментария (пусто для комментария к посту) */
  parentid: string
  /** JSON-строка с полями message, url, images, info. Не передаётся при commentDelete. */
  msg?: string
  /** Только для commentEdit/commentDelete — txid редактируемого/удаляемого комментария */
  id?: string
}

/**
 * Тип операции для sendrawtransactionwithmessage
 */
export type SendRawTransactionOperationType =
  | 'comment'
  | 'commentEdit'
  | 'commentDelete'
  | 'cScore'
  | 'upvoteShare'
  | string

/**
 * Параметры запроса sendrawtransactionwithmessage
 * [rawTxHex, messagePayload, operationType]
 */
export type SendRawTransactionWithMessageParameters = [
  rawTxHex: string,
  messagePayload: CommentMessagePayload | Record<string, unknown>,
  operationType: SendRawTransactionOperationType
]

/**
 * Запрос sendrawtransactionwithmessage API
 */
export interface SendRawTransactionWithMessageRequest extends BaseRpcRequest<SendRawTransactionWithMessageParameters> {
  method: 'sendrawtransactionwithmessage'
  parameters: SendRawTransactionWithMessageParameters
}
