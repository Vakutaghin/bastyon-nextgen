// «Песочные часы»: всё, что ушло в сеть, ждёт блока и видно в шапке, пока
// транзакция не попадёт в блок (WS или нода) или не истечёт час. Список —
// у каждого аккаунта свой и переживает перезапуск. Ноду спрашивают и по
// таймеру, и на каждом новом блоке, и после переподключения WS.

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

import {
  notifyTransactionBroadcast,
  onTransactionSettled,
} from '@/blockchain/core/transactions/broadcast-events'
import {
  isConfirmed,
  PENDING_TX_TTL_MS,
  pendingDeadline,
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

  it('оценка комментария помнит, какого и с каким знаком, — и после перезапуска', () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({
      txid: TX(9),
      operationType: 'cScore',
      meta: { address: 'PAuthor', commentId: 'c1', score: 1 },
    })
    expect(store.commentScoreOf('c1')).toBe(1)
    expect(store.commentScoreOf('c2')).toBeNull()

    // Перезапуск: прежний стор отписываем, иначе он ловит отправки других тестов.
    store.$dispose()
    setActivePinia(createPinia())
    const restarted = usePendingTransactionsStore()
    restarted.init('PAlice')
    expect(restarted.commentScoreOf('c1')).toBe(1)
    h.ws.get('transaction')?.({ txid: TX(9) })
    expect(restarted.commentScoreOf('c1')).toBeNull()
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
        ? { data: { txid: TX(3), type: 1, height: 4084009, blockHash: 'b', nTime: 1, vin: [] } }
        : { data: { txid: TX(4) } }
    )
    await store.checkWithNode()
    expect(store.items.map((i) => i.txid)).toEqual([TX(4)])
    expect(h.getByPRC.mock.calls[0]![0]).toMatchObject({
      method: 'getrawtransaction',
      parameters: [TX(3), 1],
    })
  })

  // Новый аккаунт: часы у аватара гасли, а «Регистрация» висела в списке —
  // ответ ноды Pocketnet без `confirmations` и с `blockHash` не узнавали.
  it('регистрация в блоке — снимается по ответу ноды Pocketnet', async () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    const settled: Array<[string, boolean]> = []
    const stop = onTransactionSettled((txid, ok) => settled.push([txid, ok]))
    notifyTransactionBroadcast({
      txid: TX(6),
      operationType: 'userInfo',
      meta: { kind: 'registration', title: 'nick' },
    })
    h.getByPRC.mockRejectedValueOnce(new Error('Transaction::List reconstruct failed'))
    await store.checkWithNode()
    expect(store.items.map((i) => i.txid)).toEqual([TX(6)])

    h.getByPRC.mockResolvedValue({
      result: 'success',
      data: { txid: TX(6), type: 100, height: 4084009, blockHash: '69c6f51f', nTime: 1, vin: [] },
    })
    await store.checkWithNode()
    expect(store.items).toHaveLength(0)
    expect(settled).toEqual([[TX(6), true]])
    stop()
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

  it('снятие ожидания слышно снаружи: в блоке — true, истекла — false', () => {
    vi.useFakeTimers()
    const settled: Array<[string, boolean]> = []
    const stop = onTransactionSettled((txid, ok) => settled.push([txid, ok]))
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(7), operationType: 'subscribe', meta: {} })
    notifyTransactionBroadcast({ txid: TX(8), operationType: 'unsubscribe', meta: {} })
    h.ws.get('transaction')?.({ txid: TX(7) })
    store.cleanupExpired(Date.now() + PENDING_TX_TTL_MS)
    stop()
    expect(settled).toEqual([
      [TX(7), true],
      [TX(8), false],
    ])
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

  it('новый пост и комментарий: блок ждём здесь, а в часах их показывают свои сторы', () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(1), operationType: 'share', meta: { kind: 'post' } })
    notifyTransactionBroadcast({
      txid: TX(2),
      operationType: 'comment',
      meta: { kind: 'comment', postId: 'P' },
    })
    notifyTransactionBroadcast({ txid: TX(3), operationType: 'subscribe', meta: {} })
    expect(store.items.map((i) => i.txid)).toEqual([TX(1), TX(2), TX(3)])
    expect(store.listed.map((i) => i.txid)).toEqual([TX(3)])
    expect(store.count).toBe(1)
  })

  it('новый блок, переподключение WS и возврат в приложение — спросить ноду сразу', async () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    // Нечего ждать — нода не нужна.
    h.ws.get('block')?.({})
    expect(h.getByPRC).not.toHaveBeenCalled()

    notifyTransactionBroadcast({ txid: TX(1), operationType: 'share', meta: { kind: 'post' } })
    h.getByPRC.mockResolvedValue({ data: { txid: TX(1) } })
    h.ws.get('block')?.({})
    await vi.waitFor(() => expect(h.getByPRC).toHaveBeenCalledTimes(1))
    h.ws.get('open')?.({})
    await vi.waitFor(() => expect(h.getByPRC).toHaveBeenCalledTimes(2))

    h.getByPRC.mockResolvedValue({ data: { txid: TX(1), height: 4084009, blockHash: 'b' } })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(store.items).toHaveLength(0))
  })

  it('блок пришёл, пока шла проверка, — проверить ещё раз сразу после неё', async () => {
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    notifyTransactionBroadcast({ txid: TX(1), operationType: 'share', meta: { kind: 'post' } })
    let release!: (v: unknown) => void
    h.getByPRC.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    h.getByPRC.mockResolvedValue({ data: { txid: TX(1), height: 4084009, blockHash: 'b' } })
    const first = store.checkWithNode()
    h.ws.get('block')?.({})
    release({ data: { txid: TX(1) } })
    await first
    await vi.waitFor(() => expect(store.items).toHaveLength(0))
    expect(h.getByPRC).toHaveBeenCalledTimes(2)
  })

  it('отложенный пост: до своего времени ноду не спрашиваем, ждём час после него', async () => {
    vi.useFakeTimers()
    const store = usePendingTransactionsStore()
    store.init('PAlice')
    const at = Date.now() + 3 * PENDING_TX_TTL_MS
    notifyTransactionBroadcast({
      txid: TX(9),
      operationType: 'share',
      meta: { kind: 'post', notBefore: at },
    })
    await store.checkWithNode()
    expect(h.getByPRC).not.toHaveBeenCalled()
    store.cleanupExpired(at + PENDING_TX_TTL_MS - 1)
    expect(store.items).toHaveLength(1)
    expect(pendingDeadline(store.items[0]!)).toBe(at + PENDING_TX_TTL_MS)
    store.cleanupExpired(at + PENDING_TX_TTL_MS)
    expect(store.items).toHaveLength(0)
  })
})

describe('isConfirmed', () => {
  it('Pocketnet: blockHash или height; Bitcoin: blockhash или confirmations', () => {
    expect(isConfirmed({ txid: 'a', height: 5, blockHash: 'h' }, 'a')).toBe(true)
    expect(isConfirmed({ height: 5 })).toBe(true)
    expect(isConfirmed({ blockhash: 'h' })).toBe(true)
    expect(isConfirmed({ confirmations: 1 })).toBe(true)
  })

  it('в мемпуле и чужая транзакция — нет', () => {
    expect(isConfirmed({ txid: 'a' }, 'a')).toBe(false)
    expect(isConfirmed({ txid: 'a', height: 0, blockHash: '' })).toBe(false)
    expect(isConfirmed({ txid: 'b', height: 5, blockHash: 'h' }, 'a')).toBe(false)
    expect(isConfirmed(null)).toBe(false)
  })
})
