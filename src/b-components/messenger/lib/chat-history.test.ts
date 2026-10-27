// Почему в чате нет сообщений: удалил человек, стёр сервер или чат просто
// пустой — по тому, что Matrix отдаёт о комнате.

import { describe, expect, it } from 'vitest'

import type { Message } from '../types'
import {
  historyRows,
  markDeleted,
  readHistory,
  redactionOf,
  retentionMs,
  type HistoryRoom,
} from './chat-history'

const ME = '@me:host'
const PEER = '@peer:host'

function msg(id: string, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: '!r',
    senderId: PEER,
    text: id,
    timestamp: 1_000,
    read: true,
    status: 'sent',
    ...over,
  }
}

const state = (sender: string, ts: number, content: Record<string, unknown> = {}) => ({
  getSender: () => sender,
  getTs: () => ts,
  getContent: () => content,
})

function room(
  over: Partial<HistoryRoom> & { events?: string[]; token?: string | null }
): HistoryRoom {
  const { events = [], token = null, ...rest } = over
  return {
    getMyMembership: () => 'join',
    getJoinedMembers: () => [{ userId: ME }, { userId: PEER }],
    currentState: {
      getStateEvents: (type: string) => (type === 'm.room.create' ? state(PEER, 5_000) : null),
    },
    getLiveTimeline: () => ({
      getPaginationToken: () => token,
      getEvents: () => events.map((type) => ({ getType: () => type })),
    }),
    getReadReceiptForUserId: () => null,
    findEventById: () => ({}),
    ...rest,
  }
}

describe('redactionOf', () => {
  it('удалённое событие SDK и сырое: кто и когда', () => {
    const sdk = {
      isRedacted: () => true,
      getUnsigned: () => ({ redacted_because: { sender: ME, origin_server_ts: 42 } }),
    }
    expect(redactionOf(sdk)).toEqual({ by: ME, at: 42 })
    expect(redactionOf({ unsigned: { redacted_because: { sender: PEER } } })).toEqual({
      by: PEER,
      at: 0,
    })
  })

  it('обычное событие — не удалено', () => {
    expect(redactionOf({ isRedacted: () => false, getUnsigned: () => ({}) })).toBeNull()
    expect(redactionOf(null)).toBeNull()
  })
})

describe('markDeleted и historyRows', () => {
  it('сообщение становится отметкой без текста и вложений', () => {
    const list = [msg('$a', { text: 'секрет', url: 'mxc://x', reactions: [] })]
    expect(markDeleted(list, '$a', { by: ME, at: 7 })).toBe(true)
    expect(list[0]).toMatchObject({ text: '', url: undefined, deleted: { by: ME, at: 7 } })
    expect(markDeleted(list, '$missing', { by: ME, at: 7 })).toBe(false)
  })

  it('удалённые подряд одним человеком — одна строка', () => {
    const rows = historyRows([
      msg('$1'),
      msg('$2', { deleted: { by: ME, at: 10 } }),
      msg('$3', { deleted: { by: ME, at: 20 } }),
      msg('$4', { deleted: { by: PEER, at: 30 } }),
      msg('$5'),
    ])
    expect(rows.map((r) => (r.kind === 'message' ? r.message.id : `${r.by}×${r.count}`))).toEqual([
      '$1',
      `${ME}×2`,
      `${PEER}×1`,
      '$5',
    ])
    expect(rows[1]).toMatchObject({ at: 20 })
  })

  it('без отметки сервера удалил отправитель, время — сообщения', () => {
    const rows = historyRows([msg('$1', { senderId: ME, deleted: { by: '', at: 0 } })])
    expect(rows[0]).toMatchObject({ kind: 'deleted', by: ME, at: 1_000 })
  })
})

describe('retentionMs', () => {
  it('мс числом и строки прежнего клиента', () => {
    expect(retentionMs(86_400_000)).toBe(86_400_000)
    expect(retentionMs('30d')).toBe(30 * 86_400_000)
    expect(retentionMs('20y')).toBe(20 * 31_536_000_000)
    expect(retentionMs('soon')).toBeUndefined()
    expect(retentionMs(0)).toBeUndefined()
  })
})

describe('readHistory', () => {
  it('кто и когда создал; не долистали — о чистке не судим', () => {
    const h = readHistory(room({ token: 'more' }), ME)
    expect(h).toMatchObject({ reachedStart: false, createdBy: PEER, createdAt: 5_000 })
    expect(h.purged).toBeUndefined()
  })

  it('начало ленты — по отсутствию токена или событию создания', () => {
    expect(readHistory(room({ token: null }), ME).reachedStart).toBe(true)
    expect(readHistory(room({ token: 'more', events: ['m.room.create'] }), ME).reachedStart).toBe(
      true
    )
  })

  it('квитанция на событие, которого больше нет, — сервер стёр историю', () => {
    const h = readHistory(
      room({
        getReadReceiptForUserId: (userId) =>
          userId === PEER ? { eventId: '$gone', data: { ts: 9_000 } } : { eventId: '$here' },
        findEventById: (id) => (id === '$here' ? {} : undefined),
      }),
      ME
    )
    expect(h).toMatchObject({ reachedStart: true, purged: true, purgedBefore: 9_000 })
  })

  it('все квитанции на месте — чистки не было', () => {
    const h = readHistory(room({ getReadReceiptForUserId: () => ({ eventId: '$here' }) }), ME)
    expect(h.purged).toBeUndefined()
  })

  it('приглашение: кто пригласил и когда, ленту не разбираем', () => {
    const h = readHistory(
      room({
        getMyMembership: () => 'invite',
        getMember: () => ({ events: { member: state(PEER, 7_000) } }),
      }),
      ME
    )
    expect(h).toMatchObject({ reachedStart: false, invitedBy: PEER, invitedAt: 7_000 })
  })

  it('срок хранения комнаты; «вечный» (20y трансляций) не показываем', () => {
    const withRetention = (value: unknown) =>
      room({
        currentState: {
          getStateEvents: (type: string) =>
            type === 'm.room.retention' ? state(PEER, 1, { max_lifetime: value }) : null,
        },
      })
    expect(readHistory(withRetention(7 * 86_400_000), ME).retentionMs).toBe(7 * 86_400_000)
    expect(readHistory(withRetention('20y'), ME).retentionMs).toBeUndefined()
  })
})
