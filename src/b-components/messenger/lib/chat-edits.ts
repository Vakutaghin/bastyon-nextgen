/**
 * Правки сообщений. Прежний клиент и forta.chat отправляют правку отдельным
 * событием со ссылкой на исходное (`m.relates_to.rel_type = m.replace`). У нас
 * такое событие выглядело новым сообщением: человек трижды поправил опечатку —
 * в чате стояли четыре почти одинаковых сообщения подряд, а исходное при этом
 * могло пропасть. Теперь правка меняет исходное сообщение, отдельной строкой
 * её нет.
 *
 * Новый текст лежит по-разному:
 * - прежний клиент — прямо в теле правки, без `m.new_content`;
 * - forta.chat — зашифрованное событие целиком в `m.new_content` и снаружи, а
 *   до сентября 2026 снаружи в группах не было `hash`, и прочесть можно только
 *   `m.new_content`;
 * - открытый текст — в `m.new_content`, снаружи он же с «* » впереди.
 */

import { isEditContent, editTargetOf, getEventId, getEventSender, type EventLike } from '../helpers'
import type { Message } from '../types'

type Content = Record<string, unknown>

/** Правка, разобранная как самостоятельное событие: своё id, автор, время — и новое тело. */
export interface EditEvent {
  event_id: string
  type: string
  room_id?: string
  sender: string
  origin_server_ts: number
  content: Content
}

interface EditedEvent extends EventLike {
  /** SDK: последняя принятая правка этого события. */
  replacingEvent?: () => EventLike | null
  getUnsigned?: () => Content | undefined
  unsigned?: Content
}

const asObject = (value: unknown): Content | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Content) : null

/** Новое тело сообщения из тела правки. */
export function editedContent(content: Content): Content {
  const { 'm.new_content': raw, 'm.relates_to': _relation, ...outer } = content
  const inner = asObject(raw)
  const readable = inner && typeof inner.body === 'string' ? inner : null
  if (readable?.msgtype === 'm.encrypted') return readable
  // Зашифровано снаружи, а внутри открытый текст: верим шифру, как все клиенты.
  if (outer.msgtype === 'm.encrypted') return outer
  if (readable) return readable
  const body = typeof outer.body === 'string' ? outer.body.replace(/^\* /, '') : outer.body
  return { ...outer, body }
}

const wireContentOf = (event: EventLike): Content =>
  asObject(event.getWireContent?.()) ??
  asObject(event.content) ??
  asObject(event.getContent?.()) ??
  {}

/** Событие-правка — как обычное событие с новым телом. */
export function asEditEvent(event: EventLike, roomId?: string): EditEvent {
  return {
    event_id: getEventId(event),
    type: event.getType?.() ?? event.type ?? 'm.room.message',
    room_id: event.getRoomId?.() ?? event.room_id ?? roomId,
    sender: getEventSender(event),
    origin_server_ts: event.getTs?.() ?? event.origin_server_ts ?? 0,
    content: editedContent(wireContentOf(event)),
  }
}

/**
 * Последняя правка сообщения; null — его не правили. У события SDK её выбирает
 * сам SDK, у сырого (страницы истории) её прикладывает сервер. Правка чужого
 * сообщения не считается.
 */
export function editOf(event: EditedEvent, roomId?: string): EditEvent | null {
  let latest: EventLike | null
  if (typeof event.replacingEvent === 'function') {
    latest = event.replacingEvent() ?? null
  } else {
    const relations = asObject((event.getUnsigned?.() ?? event.unsigned)?.['m.relations'])
    latest = asObject(relations?.['m.replace']) as EventLike | null
  }
  if (!latest || !isEditContent(wireContentOf(latest))) return null
  if (getEventSender(latest) !== getEventSender(event)) return null
  return asEditEvent(latest, roomId)
}

/**
 * Копия на устройстве, сохранённая прежними версиями: правки лежат в ней
 * отдельными сообщениями. Исходное получает последний текст, строка правки
 * уходит. Исходного рядом нет — остаётся сама правка, чтобы текст не пропал.
 */
export function foldEdits(list: Message[]): Message[] {
  if (!list.some((m) => isEditContent(m.rawContent))) return list
  const byId = new Map(list.map((m) => [m.id, m]))
  const edited = new Map<string, Message>()
  const folded = new Set<string>()
  for (const edit of list) {
    const target = byId.get(
      editTargetOf({ type: 'm.room.message', content: edit.rawContent ?? {} }) ?? ''
    )
    if (!target || target.senderId !== edit.senderId) continue
    folded.add(edit.id)
    const last = edited.get(target.id) ?? target
    if ((last.editedAt ?? 0) > edit.timestamp) continue
    edited.set(target.id, { ...target, text: edit.text, editedAt: edit.timestamp })
  }
  return list.filter((m) => !folded.has(m.id)).map((m) => edited.get(m.id) ?? m)
}
