// «Песочные часы»: всё, что ушло в сеть, ждёт блока и видно в шапке, пока
// транзакция не попадёт в блок (WS или нода) или не истечёт час. Список —
// у каждого аккаунта свой и переживает перезапуск.

import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  ws: new Map<string, (data: Record<string, unknown>) => void>(),
  getByPRC: vi.fn(),
}))

vi.mock('@/blockchain/ws/ws-service', () => ({
  wsService: {
    on: (event: string, handler: (data: Record<string, unknown>) => void) => {
      h.ws.set(event, handler)
      return () => h.ws.delete(event)
    },
  },
}))
vi.mock('@/helpers/api/request', () => ({ getByPRC: h.getByPRC }))

import { notifyTransactionBroadcast } from '@/blockchain/core/transactions/broadcast-events'
import {
  PENDING_TX_TTL_MS,
  pendingKindOf,
  usePendingTransactionsStore,
} from './pending-transactions-store'

const TX = (n: number) => String(n).repeat(64).slice(0, 64)

function memStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', memStorage())
  h.ws.clear()
  h.getByPRC.mockReset()
})
afterEach(() => {
  // Сторы слушают отправки на уровне модуля — отписываем, чтобы тесты не мешали друг другу.
  usePendingTransactionsStore(getActivePinia()).$dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('pendingKindOf', () => {
  it('вид — по типу транзакции; подпись отправителя важнее', () => {
    expect(pendingKindOf('contentBoost', {})).toBe('boost')
    expect(pendingKindOf('transaction', {})).toBe('transfer')
    expect(pendingKindOf('transaction', { kind: 'donate' })).toBe('donate')
    expect(pendingKindOf('subscribePrivate', {})).toBe('subscribe')
    expect(pendingKindOf('unblocking', {})).toBe('unblock')
    expect(pendingKindOf('cScore', {})).toBe('commentScore')
    expect(pendingKindOf('somethingNew', {})).toBe('other')
  })
})

describe('pending-transactions-store', () => {
  it('отправленное продвижение видно сразу и переживает перезапуск у своего аккаунта', () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({
      txid: TX(1),
      operationType: 'contentBoost',
      meta: { postId: 'POST', amount: 2.5 },
    })
    expect(store.items).toMatchObject([{ txid: TX(1), kind: 'boost', postId: 'POST', amount: 2.5 }])

    store.init('PBob')
    expect(store.count).toBe(0)

    setActivePinia(createPinia())
    const restarted = usePendingTransactionsStore()
    restarted.init('PAlice')
    expect(restarted.items.map((i) => i.txid)).toEqual([TX(1)])
  })

  it('WS сообщил о транзакции в блоке — ожидание снято', () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(2), operationType: 'subscribe', meta: { address: 'PB' } })
    h.ws.get('transaction')?.({ txid: 'other' })
    expect(store.count).toBe(1)
    h.ws.get('transaction')?.({ txid: TX(2) })
    expect(store.count).toBe(0)
  })

  it('WS промолчал — нода: в блоке снимается, в мемпуле ждёт', async () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(3), operationType: 'transaction', meta: { amount: 1 } })
    notifyTransactionBroadcast({ txid: TX(4), operationType: 'modFlag', meta: {} })
    h.getByPRC.mockImplementation(async ({ parameters }: { parameters: unknown[] }) =>
      parameters[0] === TX(3)
        ? { data: { txid: TX(3), blockhash: 'b', confirmations: 2 } }
        : { data: { txid: TX(4) } }
    )
    await store.checkWithNode()
    expect(store.items.map((i) => i.txid)).toEqual([TX(4)])
    expect(h.getByPRC.mock.calls[0]![0]).toMatchObject({
      method: 'getrawtransaction',
      parameters: [TX(3), 1],
    })
  })

  it('не подтвердилась за час — убирается', () => {
    vi.useFakeTimers()
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(5), operationType: 'userInfo', meta: { title: 'nick' } })
    store.cleanupExpired(Date.now() + PENDING_TX_TTL_MS - 1)
    expect(store.count).toBe(1)
    store.cleanupExpired(Date.now() + PENDING_TX_TTL_MS)
    expect(store.count).toBe(0)
  })

  it('без аккаунта отправки не запоминаются; одна и та же транзакция — один раз', () => {
    const store = usePendingTransactionsStore()
    store.init(null)
    notifyTransactionBroadcast({ txid: TX(6), operationType: 'subscribe', meta: {} })
    expect(store.count).toBe(0)
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(6), operationType: 'subscribe', meta: {} })
    notifyTransactionBroadcast({ txid: TX(6), operationType: 'subscribe', meta: {} })
    expect(store.count).toBe(1)
  })
})
