// Открыт ли пост «для платных подписчиков» и что делает оплата.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string },
  platform: 'web',
  fetchPayments: vi.fn(),
  fetchSettings: vi.fn(),
  pay: vi.fn(),
  save: vi.fn(),
  subscribed: new Set<string>(),
  subscribe: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@mobile/utils/platform', () => ({ getPlatform: () => mocks.platform }))
vi.mock('@/helpers/paid-subscription/payments-api', () => ({
  fetchSubscriptionPayments: mocks.fetchPayments,
}))
vi.mock('@/helpers/api/account-settings', async (original) => ({
  ...(await original<typeof import('@/helpers/api/account-settings')>()),
  fetchAccountSettings: mocks.fetchSettings,
}))
vi.mock('@/blockchain/core/actions/paid-subscription-action', () => ({
  payForSubscription: mocks.pay,
}))
vi.mock('@/blockchain/core/actions/account-settings-action', () => ({
  saveAccountSettings: mocks.save,
}))
vi.mock('./user-relations-store', () => ({
  useUserRelationsStore: () => ({
    isSubscribed: (a: string) => mocks.subscribed.has(a),
    subscribe: mocks.subscribe,
  }),
}))

import { SATOSHI } from '@/helpers/paid-subscription/plans'
import type { SubscriptionPayment } from '@/helpers/paid-subscription/status'
import { usePaidSubscriptionsStore } from './paid-subscriptions-store'

const NOW = Math.floor(Date.now() / 1000)

function payment(
  to: string,
  pkoin: number,
  daysAgo: number,
  txid = `${to}-${daysAgo}`
): SubscriptionPayment {
  return { from: 'PMe', to, txid, height: 1, amount: pkoin * SATOSHI, time: NOW - daysAgo * 86400 }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  mocks.auth.getUserAddress = 'PMe'
  mocks.platform = 'web'
  mocks.subscribed = new Set(['PAuthor'])
  mocks.fetchPayments.mockResolvedValue([])
  mocks.fetchSettings.mockResolvedValue({ paidsubscription: 10 })
})

describe('accessFor', () => {
  it('гость, свой пост, пока не знаем', () => {
    const store = usePaidSubscriptionsStore()
    expect(store.accessFor('PMe')).toBe('open')
    expect(store.accessFor('PAuthor')).toBe('checking')
    mocks.auth.getUserAddress = ''
    setActivePinia(createPinia())
    expect(usePaidSubscriptionsStore().accessFor('PAuthor')).toBe('guest')
  })

  it('оплачено и подписан — открыт; оплачено без подписки — осталось подписаться', async () => {
    mocks.fetchPayments.mockResolvedValue([payment('PAuthor', 10, 3)])
    const store = usePaidSubscriptionsStore()
    await Promise.all([store.ensureMyPayments(), store.ensurePrice('PAuthor')])
    expect(mocks.fetchPayments).toHaveBeenCalledWith({ from: 'PMe' })
    expect(store.accessFor('PAuthor')).toBe('open')
    mocks.subscribed.clear()
    expect(store.accessFor('PAuthor')).toBe('follow')
  })

  it('не оплачено — оформить; в приложении для iPhone — без оплаты', async () => {
    const store = usePaidSubscriptionsStore()
    await Promise.all([store.ensureMyPayments(), store.ensurePrice('PAuthor')])
    expect(store.accessFor('PAuthor')).toBe('buy')
    mocks.platform = 'capacitor-ios'
    expect(store.accessFor('PAuthor')).toBe('unsupported')
  })

  it('автор отключил подписку — открыто подписчикам; не назначал — оформить нельзя', async () => {
    const store = usePaidSubscriptionsStore()
    store.rememberSettings('POff', { paidsubscription: -1 })
    store.rememberSettings('PNone', {})
    mocks.subscribed.add('POff')
    expect(store.accessFor('POff')).toBe('open')
    expect(store.accessFor('PNone')).toBe('unavailable')
  })

  it('нода не ответила — «не смогли проверить», а не «оформите»', async () => {
    mocks.fetchSettings.mockRejectedValue(new Error('offline'))
    const store = usePaidSubscriptionsStore()
    await store.ensurePrice('PAuthor')
    expect(store.accessFor('PAuthor')).toBe('error')
  })
})

describe('pay', () => {
  it('заплатил — пост открыт сразу, до блока; без подписки — подписывает', async () => {
    mocks.subscribed.clear()
    mocks.pay.mockResolvedValue('tx-new')
    const store = usePaidSubscriptionsStore()
    await Promise.all([store.ensureMyPayments(), store.ensurePrice('PAuthor')])
    const status = store.statusFor('PAuthor')!
    if (status.kind !== 'inactive') throw new Error(status.kind)

    const result = await store.pay('PAuthor', status.offers[0]!)
    expect(mocks.pay).toHaveBeenCalledWith('PAuthor', 10 * SATOSHI)
    expect(mocks.subscribe).toHaveBeenCalledWith('PAuthor')
    expect(result).toEqual({ txid: 'tx-new', subscribeFailed: false })
    expect(store.statusFor('PAuthor')).toMatchObject({ kind: 'active', plan: '1m' })

    // Перезапуск: платёж ещё не в блоке, но помнится.
    setActivePinia(createPinia())
    const again = usePaidSubscriptionsStore()
    await Promise.all([again.ensureMyPayments(), again.ensurePrice('PAuthor')])
    expect(again.statusFor('PAuthor')).toMatchObject({ kind: 'active' })

    // Нода показала платёж — локальная копия больше не нужна и не задваивает сумму.
    mocks.fetchPayments.mockResolvedValue([{ ...payment('PAuthor', 10, 0), txid: 'tx-new' }])
    await again.ensureMyPayments(true)
    expect(again.allMyPayments.map((p) => p.txid)).toEqual(['tx-new'])
  })

  it('подписаться не вышло — платёж остаётся, вызывающий узнаёт', async () => {
    mocks.subscribed.clear()
    mocks.pay.mockResolvedValue('tx-2')
    mocks.subscribe.mockRejectedValue(new Error('no funds'))
    const store = usePaidSubscriptionsStore()
    await Promise.all([store.ensureMyPayments(), store.ensurePrice('PAuthor')])
    const status = store.statusFor('PAuthor')!
    if (status.kind !== 'inactive') throw new Error(status.kind)
    await expect(store.pay('PAuthor', status.offers[1]!)).resolves.toEqual({
      txid: 'tx-2',
      subscribeFailed: true,
    })
  })
})

describe('savePrice', () => {
  it('новая цена видна сразу и держится, пока нода не покажет её же', async () => {
    mocks.save.mockResolvedValue({ txid: 'tx-price', settings: {} })
    const store = usePaidSubscriptionsStore()
    await store.ensurePrice('PMe')
    expect(store.priceOf('PMe')).toBe(10)

    await store.savePrice(25)
    expect(mocks.save).toHaveBeenCalledWith(
      { paidsubscription: 25 },
      { kind: 'paidSubscriptionPrice', amount: 25 }
    )
    expect(store.priceOf('PMe')).toBe(25)
    await store.ensurePrice('PMe', true) // нода ещё отдаёт старую
    expect(store.priceOf('PMe')).toBe(25)

    mocks.fetchSettings.mockResolvedValue({ paidsubscription: 25 })
    await store.ensurePrice('PMe', true)
    expect(store.pricePending).toBeNull()
    expect(store.priceOf('PMe')).toBe(25)
  })
})
