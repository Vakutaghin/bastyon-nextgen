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
 * Настройки поста (поле `s` в SharePayload). Не участвуют в хэше serialize().
 * См. blockchain/core/actions/post-action.ts (SharePostSettings) и legacy kit.js:1473.
 */
export interface SharePayloadSettings {
  /** Порядок блоков в композере. */
  a?: string[]
  /** Тип контента: 'p' — пост, 'a' — статья. */
  v?: string
  /** Версия (для статей v2+). */
  version?: number
  /** Список видео (легаси). */
  videos?: unknown[]
  /** Режим OG-картинки для ссылок. */
  image?: string
  /** Видимость: '0' все, '1' подписчики, '2' зарегистрир., '3' платные. */
  f?: string
  /** id чат-комнаты стрима. */
  c?: string
  /** Unix-таймстамп отложенной публикации (> 1 — запланировано). */
  t?: number
}

/**
 * Тело сообщения поста (Share) — второй параметр RPC для типов
 * 'share' / 'video' / 'audio' / 'article'. Краткие ключи (legacy kit.js:1731).
 */
export interface SharePayload {
  /** Заголовок (caption). */
  c: string
  /** Тело поста (message). */
  m: string
  /** Внешняя ссылка / видео URL. */
  u: string
  /** Опрос { title, list }. */
  p: { title: string; list: string[] } | Record<string, never>
  /** Теги (макс. 5). */
  t: string[]
  /** URL картинок (макс. 10). */
  i: string[]
  /** Настройки. */
  s: SharePayloadSettings
  /** Язык. */
  l: string
  /** txid редактируемого поста ('' — новый). */
  txidEdit: string
  /** txid репостируемого поста ('' — не репост). */
  txidRepost: string
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
  | 'share'
  | 'video'
  | 'audio'
  | 'article'
  | string

/**
 * Параметры запроса sendrawtransactionwithmessage
 * [rawTxHex, messagePayload, operationType]
 */
export type SendRawTransactionWithMessageParameters = [
  rawTxHex: string,
  messagePayload: CommentMessagePayload | Record<string, unknown>,
  operationType: SendRawTransactionOperationType,
]

/**
 * Запрос sendrawtransactionwithmessage API
 */
export interface SendRawTransactionWithMessageRequest extends BaseRpcRequest<SendRawTransactionWithMessageParameters> {
  method: 'sendrawtransactionwithmessage'
  parameters: SendRawTransactionWithMessageParameters
}
