/**
 * Типы для ответа RPC метода getmissedinfo
 *
 * # getmissedinfo - получение пропущенной информации
 *
 * Ответ приходит в обёртке: { result, data, node, time }.
 * data — массив, где:
 * - data[0] — сводка по блоку (block, cntposts, contentsLang);
 * - data[1], data[2], ... — события/уведомления (msg: "event", mesType, txid, time и т.д.).
 *
 * В старом приложении: d[0] используется как block (добавляют msg: 'newblocks'),
 * d.slice(1) — как notifications, сортируют по -nblock и передают в messageHandler.
 */

import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * Контент по языкам для определённого типа
 *
 * Ключ — код языка (ru, en и т.д.)
 * Значение — количество постов
 */
export type GetMissedInfoContentsByLanguage = Record<string, number>

/**
 * Контент по типам и языкам
 *
 * Ключ — тип контента (share, video, audio, post)
 * Значение — объект язык -> количество
 */
export type GetMissedInfoContentsByType = Record<string, GetMissedInfoContentsByLanguage>

/**
 * Первый элемент data — сводка по блоку
 *
 * Содержит статистику контента в блоке (количество постов, разбивка по типам и языкам).
 */
export interface GetMissedInfoBlockItem {
  /** Номер блока (высота в блокчейне) */
  block: number
  /** Количество постов в блоке */
  cntposts: number
  /** Контент по типам и языкам (например, share: { ru: 14, en: 1 }, video: { ru: 5 }) */
  contentsLang: GetMissedInfoContentsByType
}

/**
 * Типы событий в пропущенной информации (mesType)
 *
 * По использованию в старом приложении (satolist.js):
 * - upvoteShare — оценка поста
 * - subscribe / unsubscribe / subscribePrivate — подписка
 * - answer — ответ на комментарий
 * - post — пост
 * - userInfo — смена инфо пользователя
 */
export type GetMissedInfoEventMesType =
  | 'upvoteShare'
  | 'subscribe'
  | 'unsubscribe'
  | 'subscribePrivate'
  | 'answer'
  | 'post'
  | 'userInfo'
  | 'comment'
  | 'repost'
  | string

/**
 * Элемент data[1..] — событие/уведомление
 *
 * Базовые поля присутствуют у всех событий; остальные зависят от mesType.
 * В старом приложении обрабатываются: upvoteShare (posttxid, upvoteVal), subscribe (addrFrom),
 * answer (comment, share, user), post (comment, share, user), userInfo.
 */
export interface GetMissedInfoEventItem {
  /** Адрес получателя (кому предназначено уведомление) */
  addr: string
  /** Признак события (обычно "event") */
  msg?: 'event'
  /** Тип события (upvoteShare, subscribe, answer и т.д.) */
  mesType: GetMissedInfoEventMesType
  /** Адрес отправителя (кто совершил действие) */
  addrFrom?: string
  /** ID транзакции события */
  txid: string
  /** Unix timestamp (секунды) */
  time: number
  /** Номер блока, в котором событие */
  nblock: number

  /** ID поста (для upvoteShare и др.) */
  posttxid?: string
  /** Значение оценки (для upvoteShare) */
  upvoteVal?: number

  /** Связанный пост/контент (объект, при наличии) */
  share?: unknown
  /** Связанный пользователь (объект, при наличии) */
  user?: unknown
  /** Связанный комментарий (объект, при наличии) */
  comment?: unknown

  /** Дополнительные поля в зависимости от mesType */
  [key: string]: unknown
}

/**
 * Элемент массива data — либо сводка по блоку, либо событие
 *
 * Различение: у блока есть contentsLang и cntposts, у события — mesType и msg.
 */
export type GetMissedInfoDataItem = GetMissedInfoBlockItem | GetMissedInfoEventItem

/**
 * Проверка, что элемент — сводка по блоку (а не событие)
 */
export function isGetMissedInfoBlockItem(
  item: GetMissedInfoDataItem
): item is GetMissedInfoBlockItem {
  return 'contentsLang' in item && 'cntposts' in item
}

/**
 * Проверка, что элемент — событие/уведомление
 */
export function isGetMissedInfoEventItem(
  item: GetMissedInfoDataItem
): item is GetMissedInfoEventItem {
  return 'mesType' in item && 'txid' in item
}

/**
 * Ответ getmissedinfo
 *
 * data[0] — блок (GetMissedInfoBlockItem)
 * data[1..] — события (GetMissedInfoEventItem[])
 */
export interface GetMissedInfoResponse extends BaseRpcResponse<GetMissedInfoDataItem[], StandardRpcTime> {}
