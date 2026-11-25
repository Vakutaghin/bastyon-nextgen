// Правки сообщений в том виде, в каком их шлют прежний клиент и forta.chat, —
// на настоящих событиях matrix-js-sdk и на сырых со страниц истории.

import { MatrixEvent } from 'matrix-js-sdk'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/matrix-service', () => ({ matrixService: {} }))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import {
  editTargetOf,
  getEventContent,
  isEditContent,
  isMessageEvent,
  type EventLike,
} from '../helpers'
import type { Message } from '../types'
import { editedContent, editOf, foldEdits } from './chat-edits'

const ROOM = '!dm:host'
const relation = { 'm.relates_to': { rel_type: 'm.replace', event_id: '$orig' } }

const raw = (id: string, content: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  event_id: id,
  room_id: ROOM,
  type: 'm.room.message',
  sender: '@bob:host',
  origin_server_ts: 1000,
  content,
  ...over,
})

/** Событие SDK: его строгие типы (id комнаты и события — шаблонные строки) нам не нужны. */
const sdkEvent = (json: ReturnType<typeof raw>) => new MatrixEvent(json) as unknown as EventLike

describe('новое тело сообщения', () => {
  it('прежний клиент: зашифрованное тело прямо в правке, без m.new_content', () => {
    const body = { msgtype: 'm.encrypted', body: 'hex', hash: 'h', block: 10 }
    expect(editedContent({ ...body, ...relation })).toEqual(body)
  })

  it('прежний клиент без шифрования: открытое тело', () => {
    expect(editedContent({ msgtype: 'm.text', body: 'новое', ...relation })).toEqual({
      msgtype: 'm.text',
      body: 'новое',
    })
  })

  it('forta.chat: в группе снаружи нет hash — берётся m.new_content целиком', () => {
    const full = { msgtype: 'm.encrypted', body: 'hex', hash: 'h', block: 10 }
    expect(
      editedContent({
        msgtype: 'm.encrypted',
        body: 'hex',
        block: 10,
        'm.new_content': full,
        ...relation,
      })
    ).toEqual(full)
  })

  it('открытый текст: из m.new_content, а без него — внешний без «* »', () => {
    expect(
      editedContent({
        msgtype: 'm.text',
        body: '* новое',
        'm.new_content': { msgtype: 'm.text', body: 'новое' },
        ...relation,
      })
    ).toEqual({ msgtype: 'm.text', body: 'новое' })
    expect(editedContent({ msgtype: 'm.text', body: '* новое', ...relation }).body).toBe('новое')
  })

  it('снаружи шифр, внутри открытый текст — верим шифру', () => {
    const content = {
      msgtype: 'm.encrypted',
      body: 'hex',
      'm.new_content': { msgtype: 'm.text', body: 'подложено' },
      ...relation,
    }
    expect(editedContent(content)).toEqual({ msgtype: 'm.encrypted', body: 'hex' })
  })
})

describe('правка — не сообщение', () => {
  it('узнаётся по ссылке на исходное и не считается сообщением', () => {
    const edit = raw('$e', { msgtype: 'm.text', body: 'x', ...relation })
    expect(editTargetOf(edit)).toBe('$orig')
    expect(isMessageEvent(edit)).toBe(false)
    expect(editTargetOf(sdkEvent(edit))).toBe('$orig')
    expect(isMessageEvent(sdkEvent(edit))).toBe(false)
  })

  it('ответ, реакция и обычное сообщение — не правка', () => {
    const reply = { 'm.relates_to': { 'm.in_reply_to': { event_id: '$orig' } } }
    expect(editTargetOf(raw('$e', { msgtype: 'm.text', body: 'x', ...reply }))).toBeNull()
    expect(editTargetOf(raw('$e', { msgtype: 'm.text', body: 'x' }))).toBeNull()
    expect(editTargetOf(raw('$e', relation, { type: 'm.reaction' }))).toBeNull()
    expect(isEditContent({ 'm.relates_to': { rel_type: 'm.replace' } })).toBe(false)
    expect(isEditContent(null)).toBe(false)
  })
})

describe('последняя правка сообщения', () => {
  const edit = raw(
    '$edit',
    { msgtype: 'm.text', body: 'новое', ...relation },
    { origin_server_ts: 2000 }
  )

  it('событие SDK: тело исходного не пропадает, правка — с новым текстом', () => {
    const sdk = new MatrixEvent(raw('$orig', { msgtype: 'm.text', body: 'старое' }))
    const event = sdk as unknown as EventLike
    expect(editOf(event, ROOM)).toBeNull()
    sdk.makeReplaced(new MatrixEvent(edit))
    // Ровно из-за этого исправленное прежним клиентом сообщение исчезало из ленты.
    expect(sdk.getContent()).toEqual({})
    expect(getEventContent(event)).toEqual({ msgtype: 'm.text', body: 'старое' })
    expect(editOf(event, ROOM)).toEqual({
      event_id: '$edit',
      type: 'm.room.message',
      room_id: ROOM,
      sender: '@bob:host',
      origin_server_ts: 2000,
      content: { msgtype: 'm.text', body: 'новое' },
    })
  })

  it('сырое событие: правку приложил сервер', () => {
    const event = raw(
      '$orig',
      { msgtype: 'm.text', body: 'старое' },
      { unsigned: { 'm.relations': { 'm.replace': { ...edit, room_id: undefined } } } }
    )
    expect(editOf(event, ROOM)).toMatchObject({ event_id: '$edit', room_id: ROOM })
  })

  it('чужая правка и обрезанная (без тела) — не считаются', () => {
    const relations = (replace: unknown) => ({
      unsigned: { 'm.relations': { 'm.replace': replace } },
    })
    const own = { msgtype: 'm.text', body: 'старое' }
    expect(editOf(raw('$orig', own, relations({ ...edit, sender: '@eve:host' })))).toBeNull()
    expect(
      editOf(raw('$orig', own, relations({ event_id: '$edit', sender: '@bob:host' })))
    ).toBeNull()
  })
})

describe('копия, сохранённая прежними версиями', () => {
  const msg = (
    id: string,
    timestamp: number,
    text: string,
    over: Partial<Message> = {}
  ): Message => ({
    id,
    chatId: ROOM,
    senderId: '@bob:host',
    text,
    timestamp,
    read: true,
    status: 'sent',
    rawContent: null,
    ...over,
  })
  const edits = (id: string, ts: number, text: string, over: Partial<Message> = {}) =>
    msg(id, ts, text, { rawContent: { msgtype: 'm.encrypted', ...relation }, ...over })

  it('пять версий одного сообщения — одно, с последним текстом', () => {
    const list = [
      msg('$orig', 1, 'тек кто'),
      edits('$1', 2, 'тем кто'),
      edits('$3', 4, 'тем кто им займётся'),
      edits('$2', 3, 'тем кто им'),
      msg('$other', 5, 'другое'),
    ]
    const folded = foldEdits(list)
    expect(folded.map((m) => [m.id, m.text, m.editedAt])).toEqual([
      ['$orig', 'тем кто им займётся', 4],
      ['$other', 'другое', undefined],
    ])
  })

  it('исходного рядом нет или автор другой — правка остаётся, текст не теряется', () => {
    expect(foldEdits([edits('$1', 2, 'тем кто')])).toHaveLength(1)
    const list = [msg('$orig', 1, 'моё'), edits('$1', 2, 'чужое', { senderId: '@eve:host' })]
    expect(foldEdits(list)).toEqual(list)
  })

  it('правок нет — тот же список', () => {
    const list = [msg('$a', 1, 'а')]
    expect(foldEdits(list)).toBe(list)
  })
})
