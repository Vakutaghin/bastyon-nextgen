// Извлечение и нормализация связанных сущностей из ответа RPC `getmissedinfo`.
// RPC иногда прикладывает share/comment/user к событию — мы кешируем их в snapshot,
// чтобы UI рисовал превью и открывал PostModal без доп. запросов.

import type {
  NotificationItem,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
} from './notifications-types'
import { MES_TYPE_TITLES } from './notifications-constants'

/** Первая непустая строка по списку ключей. */
export function pickStr(
  o: Record<string, unknown> | undefined | null,
  ...keys: string[]
): string | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

/** Первый массив по списку ключей. */
export function pickArr<T = unknown>(
  o: Record<string, unknown> | undefined | null,
  ...keys: string[]
): T[] | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v as T[]
  }
  return undefined
}

export function extractPostSnapshot(
  raw: unknown,
  fallbackTxid?: string
): NotificationPostSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const txid = pickStr(o, 'txid', 'hash', 'id') ?? fallbackTxid
  if (!txid) return undefined
  return {
    txid,
    caption: pickStr(o, 'c', 'caption', 'title'),
    message: pickStr(o, 'm', 'message', 'text'),
    type: pickStr(o, 'type'),
    images: pickArr<string>(o, 'i', 'images'),
  }
}

export function extractCommentSnapshot(
  raw: unknown,
  fallbackId?: string,
  fallbackPostId?: string
): NotificationCommentSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const id = pickStr(o, 'id', 'txid') ?? fallbackId
  if (!id) return undefined
  let message: string | undefined
  const msgRaw = o.msg ?? o.message
  if (typeof msgRaw === 'string') {
    try {
      const parsed = JSON.parse(msgRaw) as { message?: string }
      message = typeof parsed?.message === 'string' ? parsed.message : msgRaw
    } catch {
      message = msgRaw
    }
  } else if (msgRaw && typeof msgRaw === 'object') {
    const inner = (msgRaw as Record<string, unknown>).message
    if (typeof inner === 'string') message = inner
  }
  return {
    id,
    postid: pickStr(o, 'postid', 'rootTxHash', 'posttxid') ?? fallbackPostId,
    parentid: pickStr(o, 'parentid'),
    answerid: pickStr(o, 'answerid'),
    address: pickStr(o, 'address'),
    message,
  }
}

export function extractUserSnapshot(
  raw: unknown,
  fallbackAddress?: string
): NotificationUserSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    return fallbackAddress ? { address: fallbackAddress } : undefined
  }
  const o = raw as Record<string, unknown>
  const address = pickStr(o, 'address', 'addr') ?? fallbackAddress
  if (!address) return undefined
  return {
    address,
    name: pickStr(o, 'name'),
    avatar: pickStr(o, 'i', 'avatar'),
    reputation: typeof o.reputation === 'number' ? (o.reputation as number) : undefined,
  }
}

const ALLOWED_TYPES: NotificationItem['type'][] = [
  'comment',
  'like',
  'subscribe',
  'repost',
  'mention',
  'rating',
  'tip',
  'other',
]

const TYPE_MAP: Record<string, NotificationItem['type']> = {
  upvoteShare: 'rating',
  subscribe: 'subscribe',
  unsubscribe: 'subscribe',
  answer: 'comment',
  post: 'other',
  comment: 'comment',
  repost: 'repost',
}

/**
 * Маппит сырое событие из getmissedinfo в NotificationItem.
 * Принимает либо строго типизированный GetMissedInfoEventItem, либо Record (legacy/неизвестные mesType).
 */
export function mapMissedEventToNotification(n: Record<string, any>): NotificationItem | null {
  const id = (n.txid ?? n.id ?? n.nblock ?? Math.random().toString(36)) as string
  const nblock = Number(n.nblock ?? 0) || 0
  const mesType = (n.mesType ?? n.type) as string
  const time = Number(n.time ?? n.nTime ?? n.nblock ?? 0) || Math.floor(Date.now() / 1000)
  const title = MES_TYPE_TITLES[mesType] ?? 'Уведомление'
  const description = n.upvoteVal != null ? `Оценка: ${n.upvoteVal}` : undefined
  const link = (n.url ?? n.link) as string | undefined

  const safeType =
    TYPE_MAP[mesType] ??
    (ALLOWED_TYPES.includes(mesType as NotificationItem['type'])
      ? (mesType as NotificationItem['type'])
      : 'other')
  const upvoteVal = n.upvoteVal != null ? Number(n.upvoteVal) : undefined
  const fromAddress = (n.addrFrom ?? (n.account as Record<string, unknown>)?.address) as
    | string
    | undefined
  const shareId = (n.posttxid ?? n.rootTxHash ?? n.postHash) as string | undefined

  const postSnapshot = extractPostSnapshot(n.share, shareId)
  const commentSnapshot = extractCommentSnapshot(n.comment, String(id), shareId)
  const fromSnapshot = extractUserSnapshot(n.user, fromAddress)

  return {
    id: String(id),
    nblock,
    type: safeType,
    title: String(title),
    description,
    time,
    link,
    seen: false,
    from: fromAddress ?? fromSnapshot?.address,
    shareId,
    mesType,
    upvoteVal,
    postSnapshot,
    commentSnapshot,
    fromSnapshot,
  }
}
