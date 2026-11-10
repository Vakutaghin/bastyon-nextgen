// Что известно о транзакции перед повтором: копия в SDK (не ушла, в пути,
// дошла), событие с этим txnId уже пришло синком или ничего не известно.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const matrix = vi.hoisted(() => ({
  getClient: vi.fn(),
  getRoom: vi.fn(),
}))
vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))

import { txnIdOf, txnState } from './txn-state'

const ROOM = '!g:host'
const LOCAL = `~${ROOM}:m7.1`

const client = {
  resendEvent: vi.fn(async () => ({ event_id: '$ok' })),
  cancelPendingEvent: vi.fn(),
}

/** Копия события в SDK. */
const echo = (status: string | null, id = LOCAL) => ({ status, getId: () => id })

/** Событие ленты, пришедшее синком; `txn` — txnId, который сервер сообщил своему устройству. */
const live = (id: string, txn?: string) => ({
  getId: () => id,
  getUnsigned: () => (txn ? { transaction_id: txn } : {}),
})

function roomWith(opts: {
  byTxn?: Record<string, unknown>
  byId?: Record<string, unknown>
  timeline?: unknown[]
}) {
  return {
    roomId: ROOM,
    getEventForTxnId: (txn: string) => opts.byTxn?.[txn],
    findEventById: (id: string) => opts.byId?.[id],
    getLiveTimeline: () => ({ getEvents: () => opts.timeline ?? [] }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  matrix.getClient.mockReturnValue(client)
})

describe('txnIdOf', () => {
  it('txnId — из id эхо этого чата; чужой чат, настоящий или временный id — null', () => {
    expect(txnIdOf(ROOM, LOCAL)).toBe('m7.1')
    expect(txnIdOf(ROOM, '~!other:host:m7.1')).toBeNull()
    expect(txnIdOf(ROOM, '$real')).toBeNull()
    expect(txnIdOf(ROOM, 'local-abc')).toBeNull()
    expect(txnIdOf(ROOM, `~${ROOM}:`)).toBeNull()
  })
})

describe('txnState', () => {
  it('копия «не ушла» — повтор и отмена самой копией', async () => {
    const unsent = echo('not_sent')
    const room = roomWith({ byTxn: { 'm7.1': unsent } })
    matrix.getRoom.mockReturnValue(room)
    const state = txnState(ROOM, 'm7.1')
    expect(state.kind).toBe('unsent')
    if (state.kind !== 'unsent') return
    await expect(state.resend()).resolves.toEqual({ event_id: '$ok' })
    expect(client.resendEvent).toHaveBeenCalledWith(unsent, room)
    state.cancel()
    expect(client.cancelPendingEvent).toHaveBeenCalledWith(unsent)
  })

  it('копия в пути — pending, даже если у неё уже настоящий id', () => {
    for (const status of ['sending', 'queued', 'encrypting']) {
      matrix.getRoom.mockReturnValue(roomWith({ byTxn: { 'm7.1': echo(status, '$early') } }))
      expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'pending' })
    }
  })

  it('отменённая копия держит txnId в SDK — pending, а не новая отправка', () => {
    matrix.getRoom.mockReturnValue(roomWith({ byTxn: { 'm7.1': echo('cancelled') } }))
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'pending' })
  })

  it('копия дошла (статус снят, id настоящий) — delivered', () => {
    for (const status of [null, 'sent']) {
      matrix.getRoom.mockReturnValue(roomWith({ byTxn: { 'm7.1': echo(status, '$real') } }))
      expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'delivered', eventId: '$real' })
    }
  })

  it('SDK без getEventForTxnId — копия ищется по id эхо', () => {
    const room = {
      ...roomWith({ byId: { [LOCAL]: echo('not_sent') } }),
      getEventForTxnId: undefined,
    }
    matrix.getRoom.mockReturnValue(room)
    expect(txnState(ROOM, 'm7.1').kind).toBe('unsent')
  })

  it('копии нет (перезапуск), а событие с этим txnId пришло синком — delivered', () => {
    matrix.getRoom.mockReturnValue(
      roomWith({ timeline: [live('$other', 'm1.1'), live('$mine', 'm7.1'), live('$x')] })
    )
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'delivered', eventId: '$mine' })
  })

  it('ничего не известно — unknown: нет комнаты, клиента или следов транзакции', () => {
    matrix.getRoom.mockReturnValue(roomWith({ timeline: [live('$other', 'm1.1')] }))
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'unknown' })
    matrix.getRoom.mockReturnValue(null)
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'unknown' })
    matrix.getRoom.mockReturnValue(roomWith({}))
    matrix.getClient.mockReturnValue(null)
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'unknown' })
  })

  it('событие с txnId, но без настоящего id (`~`) — ещё не доставлено', () => {
    matrix.getRoom.mockReturnValue(roomWith({ timeline: [live(LOCAL, 'm7.1')] }))
    expect(txnState(ROOM, 'm7.1')).toEqual({ kind: 'unknown' })
  })
})
