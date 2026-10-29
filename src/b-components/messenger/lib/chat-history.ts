/**
 * Что случилось с историей чата — чтобы было видно, почему сообщений нет:
 *
 * - удалил человек: удалённое сообщение (redaction) приходит от Matrix с
 *   пустым содержимым и отметкой, кто и когда удалил; раньше оно молча
 *   пропадало из ленты;
 * - удалил сервер: Synapse стирает старую переписку (срок хранения), а
 *   квитанции прочтения остаются. Квитанция на событие, которого в
 *   долистанной до начала ленте уже нет, — след такой чистки;
 * - чат пуст: кто и когда его создал или пригласил вас — например, нажал
 *   «Начать чат» в профиле и так ничего и не написал.
 */

import type { Message } from '../types'

export interface DeletedMark {
  /** Кто удалил (matrix-id). */
  by: string
  /** Когда; 0 — неизвестно. */
  at: number
}

interface RedactableEvent {
  isRedacted?: () => boolean
  getUnsigned?: () => Record<string, unknown> | undefined
  unsigned?: Record<string, unknown>
}

/** Удалённое событие: кто и когда удалил. null — событие не удалено. */
export function redactionOf(event: unknown): DeletedMark | null {
  if (!event || typeof event !== 'object') return null
  const e = event as RedactableEvent
  const unsigned = (typeof e.getUnsigned === 'function' ? e.getUnsigned() : e.unsigned) ?? {}
  const because = unsigned.redacted_because as
    | { sender?: unknown; origin_server_ts?: unknown }
    | undefined
  const redacted = !!because || (typeof e.isRedacted === 'function' && e.isRedacted())
  if (!redacted) return null
  return {
    by: typeof because?.sender === 'string' ? because.sender : '',
    at: typeof because?.origin_server_ts === 'number' ? because.origin_server_ts : 0,
  }
}

/** Сообщение в ленте становится отметкой «удалено»; false — его там нет. */
export function markDeleted(list: Message[] | undefined, id: string, mark: DeletedMark): boolean {
  const message = list?.find((m) => m.id === id)
  if (!message) return false
  message.deleted = mark
  message.text = ''
  message.type = 'text'
  message.url = undefined
  message.info = undefined
  message.rawContent = null
  message.reactions = undefined
  message.replyTo = undefined
  return true
}

/** Строка ленты: сообщение или подряд идущие удалённые одним человеком. */
export type HistoryRow =
  | { kind: 'message'; message: Message; index: number }
  | { kind: 'deleted'; id: string; by: string; count: number; at: number }

export function historyRows(messages: readonly Message[]): HistoryRow[] {
  const rows: HistoryRow[] = []
  messages.forEach((message, index) => {
    const mark = message.deleted
    if (!mark) {
      rows.push({ kind: 'message', message, index })
      return
    }
    // Кто удалил: отметка сервера, а у своего только что удалённого — отправитель.
    const by = mark.by || message.senderId
    const at = mark.at || message.timestamp
    const last = rows[rows.length - 1]
    if (last?.kind === 'deleted' && last.by === by) {
      last.count += 1
      last.at = Math.max(last.at, at)
      return
    }
    rows.push({ kind: 'deleted', id: message.id, by, count: 1, at })
  })
  return rows
}

/** Что известно об истории чата. */
export interface ChatHistory {
  /** Лента долистана до начала: сервер больше ничего не отдаёт. */
  reachedStart: boolean
  /** Кто и когда создал чат. */
  createdBy?: string
  createdAt?: number
  /** Нас пригласили и мы ещё не вступили: кто и когда. */
  invitedBy?: string
  invitedAt?: number
  /** Сервер стёр часть переписки (есть квитанции на исчезнувшие события). */
  purged?: boolean
  /** До какого времени, судя по самой поздней такой квитанции. */
  purgedBefore?: number
  /** Срок хранения сообщений комнаты (m.room.retention), мс. */
  retentionMs?: number
  /** История не загрузилась. */
  error?: string
  /** На устройстве сохранено ещё раньше показанного: долистать до начала ещё нельзя. */
  archiveMore?: boolean
}

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  y: 31_536_000_000,
}

/** Срок хранения: мс числом (как в спецификации) или строкой «30d», «20y» (прежний клиент). */
export function retentionMs(value: unknown): number | undefined {
  if (typeof value === 'number' && value > 0) return value
  if (typeof value !== 'string') return undefined
  const match = /^(\d+(?:\.\d+)?)\s*([smhdwy])$/i.exec(value.trim())
  if (!match) return undefined
  return Number(match[1]) * UNIT_MS[match[2]!.toLowerCase()]!
}

/** Срок, после которого хранение считается вечным: так прежний клиент помечал трансляции (20y). */
const FOREVER_MS = 10 * UNIT_MS.y!

interface StateEvent {
  getTs?: () => number
  getSender?: () => string
  getContent?: () => Record<string, unknown>
}

interface WrappedReceipt {
  eventId: string
  data?: { ts?: number }
}

/** То, что нужно от комнаты matrix-js-sdk. */
export interface HistoryRoom {
  getMyMembership?: () => string
  getMember?: (userId: string) => { events?: { member?: StateEvent | null } } | null
  getJoinedMembers?: () => ReadonlyArray<{ userId: string }>
  currentState?: { getStateEvents?: (type: string, stateKey: string) => StateEvent | null }
  getLiveTimeline?: () => {
    getPaginationToken?: (direction: 'b' | 'f') => string | null
    getEvents?: () => ReadonlyArray<{ getType?: () => string }>
  }
  getReadReceiptForUserId?: (userId: string, ignoreSynthesized?: boolean) => WrappedReceipt | null
  findEventById?: (eventId: string) => unknown
}

/** Лента дошла до начала: токена назад нет или в ней событие создания. */
export function reachedHistoryStart(room: HistoryRoom): boolean {
  const timeline = room.getLiveTimeline?.()
  if (!timeline) return false
  if (timeline.getEvents?.().some((e) => e.getType?.() === 'm.room.create')) return true
  return typeof timeline.getPaginationToken === 'function'
    ? timeline.getPaginationToken('b') === null
    : false
}

function stateEvent(room: HistoryRoom, type: string): StateEvent | null {
  return room.currentState?.getStateEvents?.(type, '') ?? null
}

/** Разбор комнаты; `myUserId` — свой matrix-id. */
export function readHistory(room: HistoryRoom, myUserId: string): ChatHistory {
  const history: ChatHistory = { reachedStart: false }

  const create = stateEvent(room, 'm.room.create')
  const createdBy = create?.getSender?.() || (create?.getContent?.().creator as string | undefined)
  if (createdBy) history.createdBy = createdBy
  const createdAt = create?.getTs?.() ?? 0
  if (createdAt > 0) history.createdAt = createdAt

  const ttl = retentionMs(stateEvent(room, 'm.room.retention')?.getContent?.().max_lifetime)
  if (ttl && ttl < FOREVER_MS) history.retentionMs = ttl

  if (room.getMyMembership?.() === 'invite') {
    const invite = room.getMember?.(myUserId)?.events?.member
    const by = invite?.getSender?.()
    if (by) history.invitedBy = by
    const at = invite?.getTs?.() ?? 0
    if (at > 0) history.invitedAt = at
    return history
  }

  history.reachedStart = reachedHistoryStart(room)
  if (!history.reachedStart) return history

  // Квитанции хранятся отдельно от событий и чисткой не стираются.
  const readers = new Set([myUserId, ...(room.getJoinedMembers?.() ?? []).map((m) => m.userId)])
  for (const userId of readers) {
    if (!userId) continue
    const receipt = room.getReadReceiptForUserId?.(userId, true)
    if (!receipt?.eventId || room.findEventById?.(receipt.eventId)) continue
    history.purged = true
    const ts = receipt.data?.ts ?? 0
    if (ts > (history.purgedBefore ?? 0)) history.purgedBefore = ts
  }
  return history
}
