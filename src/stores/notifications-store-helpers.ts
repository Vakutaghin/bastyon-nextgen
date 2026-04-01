// Хелперы стора уведомлений: маппинг событий, извлечение данных из ответа

import type { GetMissedInfoEventItem } from '@/types/rpc-responses/get-missed-info'

import {
  MESSAGE_TYPE_TITLES,
  MESSAGE_TYPE_MAP,
  ALLOWED_NOTIFICATION_TYPES,
} from './notifications-store-consts'

/** Элемент уведомления для отображения */
export interface NotificationItem {
  id: string
  type: typeof ALLOWED_NOTIFICATION_TYPES[number]
  title: string
  description?: string
  time: number
  read: boolean
  nblock: number
  link?: string
  mesType?: string
  address?: string
  txid?: string
}

/**
 * Маппит событие из RPC-ответа getmissedinfo в NotificationItem.
 * Возвращает null для невалидных событий.
 */
export function mapMissedEventToNotification(
  n: GetMissedInfoEventItem | Record<string, unknown>,
): NotificationItem | null {
  const id = (n.txid ?? n.id ?? n.nblock ?? Math.random().toString(36)) as string
  const nblock = Number(n.nblock ?? 0) || 0
  const mesType = (n.mesType ?? n.type) as string
  const time = Number(n.time ?? n.nTime ?? n.nblock ?? 0) || Math.floor(Date.now() / 1000)
  const title = MESSAGE_TYPE_TITLES[mesType] ?? 'Уведомление'

  let description: string | undefined
  if (n.upvoteVal != null) description = `Оценка: ${n.upvoteVal}`

  const link = (n.url ?? n.link) as string | undefined
  const resolvedType = (MESSAGE_TYPE_MAP[mesType] ?? 'other') as NotificationItem['type']

  if (!ALLOWED_NOTIFICATION_TYPES.includes(resolvedType as any)) {
    return null
  }

  return {
    id: String(id),
    type: resolvedType,
    title,
    description,
    time,
    read: false,
    nblock,
    link,
    mesType,
    address: n.addrFrom as string | undefined,
    txid: n.txid as string | undefined,
  }
}

/**
 * Извлекает массив из различных форматов обёрток RPC-ответа.
 */
export function unwrapNotificationResponse(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.result)) return obj.result
  }
  return []
}

/**
 * Определяет, является ли ошибка таймаутом или ретрайабельной (408, 500).
 */
export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  const code = Number(e.code ?? e.status ?? e.statusCode ?? 0)
  if (code === 408 || code === 500) return true
  const msg = String(e.message ?? e.msg ?? '')
  return msg.toLowerCase().includes('timeout')
}
