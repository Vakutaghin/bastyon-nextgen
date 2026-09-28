// Отношения с другими аккаунтами: блок-лист из getuserprofile и подписки из
// getusersubscribes (с опечаткой adddress у ноды и разными видами private),
// блокировка и подписки — сразу в интерфейсе и откат при отказе сети,
// блокировка глушит и чат (S43), проверка «заблокировал ли меня автор» (#34)
// с кешем и повтором после сетевой ошибки.

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
vi.mock('@/b-components/messenger/services/matrix-service', () => ({
  matrixService: {
    getClient: () => mocks.matrixClient,
    setIgnoredByAddress: mocks.setIgnoredByAddress,
  },
}))

import { useUserRelationsStore } from './user-relations-store'

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
  afterEach(() => vi.restoreAllMocks())

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
    it('публичная → приватная → отписка', async () => {
      const store = useUserRelationsStore()
      await store.subscribe('PFriend')
      expect(store.isSubscribed('PFriend')).toBe(true)
      expect(store.isSubscribedPrivate('PFriend')).toBe(false)

      await store.subscribePrivate('PFriend')
      expect(store.isSubscribedPrivate('PFriend')).toBe(true)

      await store.subscribe('PFriend')
      expect(store.isSubscribedPrivate('PFriend')).toBe(false)
      expect(mocks.subscribeUser).toHaveBeenCalledTimes(2)

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
