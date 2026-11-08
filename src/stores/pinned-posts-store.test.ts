// Закреплённый пост профиля: что показывает сеть, своё отправленное до блока
// и как закрепление уживается с новой ценой подписки — транзакция одна на все
// настройки аккаунта.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string },
  fetchSettings: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/account-settings', async (original) => ({
  ...(await original<typeof import('@/helpers/api/account-settings')>()),
  fetchAccountSettings: mocks.fetchSettings,
}))
vi.mock('@/blockchain/core/actions/account-settings-action', () => ({
  saveAccountSettings: mocks.save,
}))
vi.mock('./user-relations-store', () => ({
  useUserRelationsStore: () => ({ isSubscribed: () => false, subscribe: vi.fn() }),
}))

import { pinOfSettings, usePinnedPostsStore } from './pinned-posts-store'
import { usePaidSubscriptionsStore } from './paid-subscriptions-store'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  mocks.auth.getUserAddress = 'PMe'
  mocks.fetchSettings.mockResolvedValue({ pin: A, paidsubscription: 10 })
  mocks.save.mockResolvedValue({ txid: 'tx-pin', settings: {} })
})

describe('pinOfSettings', () => {
  it('только txid; мусор и пустота — ничего не закреплено', () => {
    expect(pinOfSettings({ pin: A })).toBe(A)
    expect(pinOfSettings({ pin: '' })).toBe('')
    expect(pinOfSettings({ pin: 'not-a-txid' })).toBe('')
    expect(pinOfSettings({})).toBe('')
  })
})

describe('чужой профиль', () => {
  it('по данным сети; один запрос, пока данные свежие', async () => {
    const store = usePinnedPostsStore()
    expect(store.pinOf('PBob')).toBeUndefined()
    await Promise.all([store.ensure('PBob'), store.ensure('PBob')])
    await store.ensure('PBob')
    expect(store.pinOf('PBob')).toBe(A)
    expect(mocks.fetchSettings).toHaveBeenCalledTimes(1)
  })

  it('настройки, которые страница профиля уже загрузила, запроса не требуют', async () => {
    const store = usePinnedPostsStore()
    store.remember('PBob', { pin: B })
    await store.ensure('PBob')
    expect(store.pinOf('PBob')).toBe(B)
    expect(mocks.fetchSettings).not.toHaveBeenCalled()
  })
})

describe('setPin', () => {
  it('своё закрепление видно сразу и держится, пока сеть не покажет его же', async () => {
    const store = usePinnedPostsStore()
    store.remember('PMe', { pin: A })

    await store.setPin(B)
    expect(mocks.save).toHaveBeenCalledWith({ pin: B }, { kind: 'postPin', postId: B })
    expect(store.pinOf('PMe')).toBe(B)

    store.remember('PMe', { pin: A }) // нода ещё отдаёт прежнее
    expect(store.pinOf('PMe')).toBe(B)

    store.remember('PMe', { pin: B })
    expect(store.pending).toBeNull()
    expect(store.pinOf('PMe')).toBe(B)
  })

  it('открепить — пустой pin; в часиках — пост, который открепили', async () => {
    const store = usePinnedPostsStore()
    await store.setPin('', A)
    expect(mocks.save).toHaveBeenCalledWith({ pin: '' }, { kind: 'postPin', postId: A })
    expect(store.pinOf('PMe')).toBe('')
  })

  it('отправленное переживает перезапуск, но не чужому аккаунту', async () => {
    await usePinnedPostsStore().setPin(B)

    setActivePinia(createPinia())
    expect(usePinnedPostsStore().pinOf('PMe')).toBe(B)

    setActivePinia(createPinia())
    mocks.auth.getUserAddress = 'POther'
    expect(usePinnedPostsStore().pinOf('PMe')).toBeUndefined()
  })

  it('несёт свою неподтверждённую цену подписки — иначе транзакция стёрла бы её', async () => {
    mocks.save.mockResolvedValueOnce({ txid: 'tx-price', settings: {} })
    await usePaidSubscriptionsStore().savePrice(25)

    await usePinnedPostsStore().setPin(B)
    expect(mocks.save).toHaveBeenLastCalledWith(
      { pin: B, paidsubscription: 25 },
      { kind: 'postPin', postId: B }
    )
  })

  it('новая цена подписки несёт своё неподтверждённое закрепление', async () => {
    await usePinnedPostsStore().setPin(B)
    mocks.save.mockResolvedValueOnce({ txid: 'tx-price', settings: {} })

    await usePaidSubscriptionsStore().savePrice(25)
    expect(mocks.save).toHaveBeenLastCalledWith(
      { paidsubscription: 25, pin: B },
      { kind: 'paidSubscriptionPrice', amount: 25 }
    )
  })

  it('не отправилось — ничего не меняется', async () => {
    mocks.save.mockRejectedValueOnce(new Error('no funds'))
    const store = usePinnedPostsStore()
    store.remember('PMe', { pin: A })
    await expect(store.setPin(B)).rejects.toThrow('no funds')
    expect(store.pinOf('PMe')).toBe(A)
  })
})
