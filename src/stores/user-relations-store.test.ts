// Отношения с другими аккаунтами: блок-лист из getuserprofile и подписки из
// getusersubscribes (с опечаткой adddress у ноды и разными видами private),
// блокировка и подписки — сразу в интерфейсе и откат при отказе сети,
// блокировка глушит и чат (S43), проверка «заблокировал ли меня автор» (#34)
// с кешем и повтором после сетевой ошибки. Повторное нажатие до блока прошлой
// транзакции по адресу ждёт блока и уходит после него (нода отклонила бы).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string | null },
  rpcCall: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  subscribeUser: vi.fn(),
  subscribeUserPrivate: vi.fn(),
  unsubscribeUser: vi.fn(),
  matrixClient: {} as unknown,
  setIgnoredByAddress: vi.fn(),
  pendingItems: [] as Array<{ txid: string; kind: string; address?: string }>,
  toastError: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/request', () => ({ rpcCall: mocks.rpcCall }))
vi.mock('@/blockchain/core/actions/user-relations-action', () => ({
  blockUser: mocks.blockUser,
  unblockUser: mocks.unblockUser,
  subscribeUser: mocks.subscribeUser,
  subscribeUserPrivate: mocks.subscribeUserPrivate,
  unsubscribeUser: mocks.unsubscribeUser,
}))
vi.mock('@/stores/pending-transactions-store', () => ({
  usePendingTransactionsStore: () => ({ items: mocks.pendingItems }),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: mocks.toastError } }))
vi.mock('@/b-components/messenger/services/matrix-service', () => ({
  matrixService: {
    getClient: () => mocks.matrixClient,
    setIgnoredByAddress: mocks.setIgnoredByAddress,
  },
}))

import { notifyTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import { useUserRelationsStore } from './user-relations-store'

/** Транзакция попала в блок. */
const confirmed = (txid: string): void => notifyTransactionSettled(txid, true)

/** Ответы ноды: профили по адресу и подписки текущего пользователя. */
function node(opts: {
  profiles?: Record<string, { blocking?: unknown[] }>
  subscribes?: Array<Record<string, unknown>>
}) {
  mocks.rpcCall.mockImplementation(async (req: { method: string; parameters: unknown[] }) => {
    if (req.method === 'getusersubscribes') return opts.subscribes ?? []
    const addresses = (req.parameters[0] as string[]) ?? []
    return addresses.map((address) => ({ address, ...(opts.profiles?.[address] ?? {}) }))
  })
}

describe('userRelations store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.auth.getUserAddress = 'PMe'
    mocks.matrixClient = {}
    mocks.pendingItems = []
    mocks.toastError.mockReset()
    localStorage.clear()
    for (const fn of [
      mocks.rpcCall,
      mocks.blockUser,
      mocks.unblockUser,
      mocks.subscribeUser,
      mocks.subscribeUserPrivate,
      mocks.unsubscribeUser,
      mocks.setIgnoredByAddress,
    ])
      fn.mockReset()
    for (const fn of [
      mocks.blockUser,
      mocks.unblockUser,
      mocks.subscribeUser,
      mocks.subscribeUserPrivate,
      mocks.unsubscribeUser,
    ])
      fn.mockResolvedValue('tx')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    useUserRelationsStore().reset()
    vi.restoreAllMocks()
  })

  it('init: блок-лист из своего профиля, подписки — публичные и приватные, один раз за сессию', async () => {
    node({
      profiles: { PMe: { blocking: ['PBad', '', 42, 'PWorse'] } },
      subscribes: [
        { adddress: 'PFriend', private: 'false' },
        { address: 'PClose', private: 'true' },
        { adddress: 'PNotify', private: 1 },
        { adddress: '' },
      ],
    })
    const store = useUserRelationsStore()
    await store.init()

    expect([...store.blocked]).toEqual(['PBad', 'PWorse'])
    expect(store.isBlocked('PBad')).toBe(true)
    expect([...store.subscribed]).toEqual(['PFriend', 'PClose', 'PNotify'])
    expect(store.isSubscribedPrivate('PClose')).toBe(true)
    expect(store.isSubscribedPrivate('PNotify')).toBe(true)
    expect(store.isSubscribedPrivate('PFriend')).toBe(false)
    expect(mocks.rpcCall).toHaveBeenCalledWith({
      method: 'getusersubscribes',
      parameters: ['PMe', '', '', 0, 5000],
      options: { auth: false },
    })

    await store.init()
    expect(mocks.rpcCall).toHaveBeenCalledTimes(2)
  })

  it('второй init во время загрузки ждёт её: «не подписан» до ответа ноды не показывается', async () => {
    let answer: (list: unknown[]) => void = () => {}
    mocks.rpcCall.mockImplementation(async (req: { method: string }) =>
      req.method === 'getusersubscribes'
        ? new Promise((resolve) => (answer = resolve))
        : [{ address: 'PMe' }]
    )
    const store = useUserRelationsStore()
    void store.init()
    let second = false
    void store.init().then(() => (second = true))
    await Promise.resolve()
    await Promise.resolve()
    expect(second).toBe(false)
    expect(store.subscriptionsLoaded).toBe(false)

    answer([{ adddress: 'PFriend' }])
    await vi.waitFor(() => expect(second).toBe(true))
    expect(store.subscriptionsLoaded).toBe(true)
    expect(store.isSubscribed('PFriend')).toBe(true)
  })

  it('без входа ничего не грузит; ошибка ноды не роняет стор', async () => {
    mocks.auth.getUserAddress = null
    const store = useUserRelationsStore()
    await store.refresh()
    await store.refreshSubscriptions()
    expect(mocks.rpcCall).not.toHaveBeenCalled()

    mocks.auth.getUserAddress = 'PMe'
    mocks.rpcCall.mockRejectedValue(new Error('offline'))
    await expect(store.refresh()).resolves.toBeUndefined()
    expect(store.isLoading).toBe(false)
    // Подписки не пришли — «не подписан» ещё ничего не значит.
    await store.refreshSubscriptions()
    expect(store.subscriptionsLoaded).toBe(false)
  })

  it('подписки не пришли — кнопке рано говорить «Подписаться», загрузка повторяется сама', async () => {
    vi.useFakeTimers()
    try {
      let online = false
      mocks.rpcCall.mockImplementation(async (req: { method: string }) => {
        if (req.method !== 'getusersubscribes') return [{ address: 'PMe' }]
        if (!online) throw new Error('offline')
        return [{ adddress: 'PFriend' }]
      })
      const store = useUserRelationsStore()
      await store.init()
      expect(store.isSubscriptionKnown('PFriend')).toBe(false)
      expect(store.isSubscriptionKnown('PStranger')).toBe(false)

      // Первый повтор через 3 с — сеть ещё лежит; второй через 6 с.
      await vi.advanceTimersByTimeAsync(3_000)
      expect(store.subscriptionsLoaded).toBe(false)
      online = true
      await vi.advanceTimersByTimeAsync(6_000)
      expect(store.subscriptionsLoaded).toBe(true)
      expect(store.isSubscriptionKnown('PStranger')).toBe(true)
      expect(store.isSubscribed('PFriend')).toBe(true)

      // Загрузились — больше не повторяем.
      const calls = mocks.rpcCall.mock.calls.length
      await vi.advanceTimersByTimeAsync(120_000)
      expect(mocks.rpcCall.mock.calls.length).toBe(calls)
    } finally {
      vi.useRealTimers()
    }
  })

  it('повтор не идёт после выхода из аккаунта', async () => {
    vi.useFakeTimers()
    try {
      mocks.rpcCall.mockRejectedValue(new Error('offline'))
      const store = useUserRelationsStore()
      await store.refreshSubscriptions()
      store.reset()
      mocks.rpcCall.mockClear()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(mocks.rpcCall).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  describe('блокировка', () => {
    it('сразу в интерфейсе, пока транзакция идёт — кнопка занята; потом глушится и чат', async () => {
      let finish!: (tx: string) => void
      mocks.blockUser.mockReturnValue(new Promise((resolve) => (finish = resolve)))
      const store = useUserRelationsStore()
      const pending = store.block('PBad')
      expect(store.isBlocked('PBad')).toBe(true)
      expect(store.isPending('PBad')).toBe(true)

      await store.block('PBad')
      expect(mocks.blockUser).toHaveBeenCalledTimes(1)

      finish('tx')
      await pending
      expect(store.isPending('PBad')).toBe(false)
      await vi.waitFor(() => expect(mocks.setIgnoredByAddress).toHaveBeenCalledWith('PBad', true))
    })

    it('отказ сети — блокировка снята, ошибка пробрасывается', async () => {
      mocks.blockUser.mockRejectedValue(new Error('limit'))
      const store = useUserRelationsStore()
      await expect(store.block('PBad')).rejects.toThrow('limit')
      expect(store.isBlocked('PBad')).toBe(false)
      expect(store.isPending('PBad')).toBe(false)
      expect(mocks.setIgnoredByAddress).not.toHaveBeenCalled()
    })

    it('разблокировка возвращает чат; при отказе адрес снова заблокирован', async () => {
      node({ profiles: { PMe: { blocking: ['PBad'] } } })
      const store = useUserRelationsStore()
      await store.refresh()

      mocks.unblockUser.mockRejectedValueOnce(new Error('offline'))
      await expect(store.unblock('PBad')).rejects.toThrow('offline')
      expect(store.isBlocked('PBad')).toBe(true)

      await store.unblock('PBad')
      expect(store.isBlocked('PBad')).toBe(false)
      await vi.waitFor(() => expect(mocks.setIgnoredByAddress).toHaveBeenCalledWith('PBad', false))
    })

    it('мессенджер не запущен — блокировка всё равно проходит', async () => {
      mocks.matrixClient = null
      const store = useUserRelationsStore()
      await store.block('PBad')
      expect(store.isBlocked('PBad')).toBe(true)
      expect(mocks.setIgnoredByAddress).not.toHaveBeenCalled()
    })

    it('повторная блокировка заблокированного и разблокировка незаблокированного — без транзакций', async () => {
      const store = useUserRelationsStore()
      await store.unblock('PNobody')
      await store.block('')
      expect(mocks.unblockUser).not.toHaveBeenCalled()
      expect(mocks.blockUser).not.toHaveBeenCalled()
    })
  })

  describe('подписки', () => {
    it('публичная → приватная → отписка, каждая после блока прошлой', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('tx1').mockResolvedValueOnce('tx3')
      mocks.subscribeUserPrivate.mockResolvedValueOnce('tx2')
      mocks.unsubscribeUser.mockResolvedValueOnce('tx4')
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')
      expect(store.isSubscribed('PFriend')).toBe(true)
      expect(store.isSubscribedPrivate('PFriend')).toBe(false)
      confirmed('tx1')

      await store.subscribePrivate('PFriend')
      expect(store.isSubscribedPrivate('PFriend')).toBe(true)
      confirmed('tx2')

      await store.subscribe('PFriend')
      expect(store.isSubscribedPrivate('PFriend')).toBe(false)
      expect(mocks.subscribeUser).toHaveBeenCalledTimes(2)
      confirmed('tx3')

      await store.unsubscribe('PFriend')
      expect(store.isSubscribed('PFriend')).toBe(false)
      expect(mocks.unsubscribeUser).toHaveBeenCalledWith('PFriend')
    })

    it('повтор того же действия — без транзакции', async () => {
      const store = useUserRelationsStore()
      await store.unsubscribe('PStranger')
      await store.subscribe('PFriend')
      await store.subscribe('PFriend')
      await store.subscribePrivate('PClose')
      await store.subscribePrivate('PClose')
      expect(mocks.unsubscribeUser).not.toHaveBeenCalled()
      expect(mocks.subscribeUser).toHaveBeenCalledTimes(1)
      expect(mocks.subscribeUserPrivate).toHaveBeenCalledTimes(1)
    })

    it('отказ сети возвращает оба признака как были', async () => {
      node({ subscribes: [{ adddress: 'PClose', private: true }] })
      const store = useUserRelationsStore()
      await store.refreshSubscriptions()

      mocks.subscribeUser.mockRejectedValueOnce(new Error('offline'))
      await expect(store.subscribe('PClose')).rejects.toThrow('offline')
      expect(store.isSubscribed('PClose')).toBe(true)
      expect(store.isSubscribedPrivate('PClose')).toBe(true)

      mocks.unsubscribeUser.mockRejectedValueOnce(new Error('offline'))
      await expect(store.unsubscribe('PClose')).rejects.toThrow('offline')
      expect(store.isSubscribedPrivate('PClose')).toBe(true)
      expect(store.isSubscribePending('PClose')).toBe(false)

      mocks.subscribeUserPrivate.mockRejectedValueOnce(new Error('offline'))
      await expect(store.subscribePrivate('PNew')).rejects.toThrow('offline')
      expect(store.isSubscribed('PNew')).toBe(false)
    })
  })

  describe('нажатие до блока прошлой транзакции', () => {
    it('подписался и сразу отписался: кнопка сразу «подписаться», отписка уходит после блока', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      mocks.unsubscribeUser.mockResolvedValueOnce('txUnsub')
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')

      await expect(store.setSubscription('PFriend', 'none')).resolves.toBe('queued')
      expect(store.isSubscribed('PFriend')).toBe(false)
      expect(store.isSubscribePending('PFriend')).toBe(false)
      expect(mocks.unsubscribeUser).not.toHaveBeenCalled()

      confirmed('txSub')
      await vi.waitFor(() => expect(mocks.unsubscribeUser).toHaveBeenCalledWith('PFriend'))
      expect(store.isSubscribed('PFriend')).toBe(false)
    })

    it('передумал ещё раз до блока — после блока ничего не уходит', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')
      await store.unsubscribe('PFriend')
      await store.subscribe('PFriend')
      expect(store.isSubscribed('PFriend')).toBe(true)

      confirmed('txSub')
      await Promise.resolve()
      expect(mocks.subscribeUser).toHaveBeenCalledTimes(1)
      expect(mocks.unsubscribeUser).not.toHaveBeenCalled()
    })

    it('отложенная транзакция не ушла — кнопка как в цепочке, человеку сказано почему', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      mocks.unsubscribeUser.mockRejectedValueOnce(new Error('нет монет'))
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')
      await store.unsubscribe('PFriend')

      confirmed('txSub')
      await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
      expect(mocks.toastError.mock.calls[0]?.[0].message).toContain('нет монет')
      expect(store.isSubscribed('PFriend')).toBe(true)
    })

    it('транзакция за час не попала в блок — сверка с нодой решает, слать ли отложенное', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      mocks.unsubscribeUser.mockResolvedValueOnce('txUnsub')
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')
      await store.unsubscribe('PFriend')

      // Подписки в цепочке нет — отписываться не от чего.
      node({ subscribes: [] })
      notifyTransactionSettled('txSub', false)
      await vi.waitFor(() =>
        expect(mocks.rpcCall).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'getusersubscribes' })
        )
      )
      await Promise.resolve()
      expect(mocks.unsubscribeUser).not.toHaveBeenCalled()
      expect(store.isSubscribed('PFriend')).toBe(false)
    })

    it('очередь переживает перезапуск и уходит, когда первая транзакция уже в цепочке', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      const first = useUserRelationsStore()
      await first.subscribe('PFriend')
      await first.unsubscribe('PFriend')
      first.reset()

      setActivePinia(createPinia())
      mocks.unsubscribeUser.mockResolvedValueOnce('txUnsub')
      node({ subscribes: [{ adddress: 'PFriend' }] })
      const store = useUserRelationsStore()
      await store.init()
      await vi.waitFor(() => expect(mocks.unsubscribeUser).toHaveBeenCalledWith('PFriend'))
      expect(store.isSubscribed('PFriend')).toBe(false)
    })

    it('после перезапуска очередь ждёт блока первой транзакции, если та ещё в пути', async () => {
      mocks.subscribeUser.mockResolvedValueOnce('txSub')
      const first = useUserRelationsStore()
      await first.subscribe('PFriend')
      await first.unsubscribe('PFriend')
      first.reset()

      setActivePinia(createPinia())
      mocks.pendingItems = [{ txid: 'txSub', kind: 'subscribe', address: 'PFriend' }]
      mocks.unsubscribeUser.mockResolvedValueOnce('txUnsub')
      node({ subscribes: [] })
      const store = useUserRelationsStore()
      await store.init()
      expect(store.isSubscribed('PFriend')).toBe(false)
      expect(mocks.unsubscribeUser).not.toHaveBeenCalled()

      confirmed('txSub')
      await vi.waitFor(() => expect(mocks.unsubscribeUser).toHaveBeenCalledWith('PFriend'))
    })

    it('после перезапуска подписка ещё в пути — повторная не уходит (нода ответила бы «уже подписан»)', async () => {
      mocks.pendingItems = [{ txid: 'txOld', kind: 'subscribe', address: 'PFriend' }]
      node({ subscribes: [] })
      const store = useUserRelationsStore()
      await store.init()

      await expect(store.setSubscription('PFriend', 'public')).resolves.toBe('queued')
      expect(store.isSubscribed('PFriend')).toBe(true)
      confirmed('txOld')
      await Promise.resolve()
      expect(mocks.subscribeUser).not.toHaveBeenCalled()
    })

    it('заблокировал и сразу разблокировал — разблокировка после блока, чат возвращается', async () => {
      mocks.blockUser.mockResolvedValueOnce('txBlock')
      mocks.unblockUser.mockResolvedValueOnce('txUnblock')
      const store = useUserRelationsStore()
      await store.block('PBad')
      await store.unblock('PBad')
      expect(store.isBlocked('PBad')).toBe(false)
      expect(mocks.unblockUser).not.toHaveBeenCalled()

      confirmed('txBlock')
      await vi.waitFor(() => expect(mocks.unblockUser).toHaveBeenCalledWith('PBad'))
      await vi.waitFor(() => expect(mocks.setIgnoredByAddress).toHaveBeenCalledWith('PBad', false))
    })
  })

  describe('checkBannedBy', () => {
    it('автор, заблокировавший меня, запоминается; повторно нода не спрашивается', async () => {
      node({ profiles: { PAuthor: { blocking: ['PMe'] }, PKind: { blocking: [] } } })
      const store = useUserRelationsStore()
      await store.checkBannedBy('PAuthor')
      await store.checkBannedBy('PKind')
      expect(store.isBannedBy('PAuthor')).toBe(true)
      expect(store.isBannedBy('PKind')).toBe(false)

      await store.checkBannedBy('PAuthor')
      expect(mocks.rpcCall).toHaveBeenCalledTimes(2)
    })

    it('сетевая ошибка — можно проверить снова; себя не проверяет', async () => {
      mocks.rpcCall.mockRejectedValueOnce(new Error('offline'))
      const store = useUserRelationsStore()
      await store.checkBannedBy('PAuthor')
      node({ profiles: { PAuthor: { blocking: ['PMe'] } } })
      await store.checkBannedBy('PAuthor')
      expect(store.isBannedBy('PAuthor')).toBe(true)

      mocks.rpcCall.mockClear()
      await store.checkBannedBy('PMe')
      expect(mocks.rpcCall).not.toHaveBeenCalled()
    })
  })

  it('reset при выходе забывает всё и позволяет init заново', async () => {
    node({ profiles: { PMe: { blocking: ['PBad'] } }, subscribes: [{ adddress: 'PFriend' }] })
    const store = useUserRelationsStore()
    await store.init()
    store.reset()
    expect(store.blocked.size).toBe(0)
    expect(store.subscribed.size).toBe(0)
    expect(store.isInitialized).toBe(false)
    await store.init()
    expect(store.isBlocked('PBad')).toBe(true)
  })
})
