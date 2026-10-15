// Пост «для платных подписчиков» открыт тому, у кого подписка оплачена и кто
// подписан на автора; остальным — плашка с причиной.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string },
  subscribed: new Set<string>(),
  payments: [] as unknown[],
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@mobile/utils/platform', () => ({ getPlatform: () => 'web' }))
vi.mock('@/stores/user-relations-store', () => ({
  useUserRelationsStore: () => ({ isSubscribed: (a: string) => mocks.subscribed.has(a) }),
}))
vi.mock('@/helpers/paid-subscription/payments-api', () => ({
  fetchSubscriptionPayments: async () => mocks.payments,
}))
vi.mock('@/helpers/api/account-settings', async (original) => ({
  ...(await original<typeof import('@/helpers/api/account-settings')>()),
  fetchAccountSettings: async () => ({ paidsubscription: 10 }),
}))

import { SATOSHI } from '@/helpers/paid-subscription/plans'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { usePostRestriction } from './use-post-restriction'

const NOW = Math.floor(Date.now() / 1000)

beforeEach(() => {
  setActivePinia(createPinia())
  mocks.auth.getUserAddress = 'PMe'
  mocks.subscribed = new Set(['PAuthor'])
  mocks.payments = []
})

async function loaded() {
  const store = usePaidSubscriptionsStore()
  await Promise.all([store.ensureMyPayments(), store.ensurePrice('PAuthor')])
  return usePostRestriction()
}

describe('usePostRestriction', () => {
  it('не оплачено — закрыт платной подпиской, с автором', async () => {
    const restrictionOf = await loaded()
    expect(restrictionOf('PAuthor', '3')).toEqual({ reason: 'paid', author: 'PAuthor' })
  })

  it('оплачено и подписан — открыт', async () => {
    mocks.payments = [
      { from: 'PMe', to: 'PAuthor', txid: 't', height: 1, amount: 10 * SATOSHI, time: NOW - 60 },
    ]
    const restrictionOf = await loaded()
    expect(restrictionOf('PAuthor', '3')).toBeNull()
    // Остальные виды видимости — как раньше.
    expect(restrictionOf('PAuthor', '1')).toBeNull()
    mocks.subscribed.clear()
    expect(restrictionOf('PAuthor', '1')).toEqual({ reason: 'subscribers', author: 'PAuthor' })
    expect(restrictionOf('PAuthor', '3')).toEqual({ reason: 'paid', author: 'PAuthor' })
  })

  it('свой пост и пост для всех — открыты', async () => {
    const restrictionOf = await loaded()
    expect(restrictionOf('PMe', '3')).toBeNull()
    expect(restrictionOf('PAuthor', '0')).toBeNull()
  })
})
