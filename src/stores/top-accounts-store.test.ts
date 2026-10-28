// Стор топа: «по PKOIN» — у кого баланс известен, по убыванию, без ответа
// ноды — в конце; один и тот же баланс не запрашивается дважды; свежий топ не
// собирается заново, а неудачная сборка без прежнего списка — ошибка.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchTop: vi.fn(),
  fetchBalance: vi.fn(),
  fetchProfiles: vi.fn(async () => []),
}))
vi.mock('@/services/top-accounts', () => ({
  fetchTopByReputation: mocks.fetchTop,
  fetchBalance: mocks.fetchBalance,
  fetchProfiles: mocks.fetchProfiles,
}))

import { useTopAccountsStore } from './top-accounts-store'

const ENTRIES = [
  { address: 'A', reputation: 30 },
  { address: 'B', reputation: 20 },
  { address: 'C', reputation: 10 },
]

describe('useTopAccountsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.fetchTop.mockReset().mockResolvedValue({ entries: ENTRIES, profiles: [] })
    mocks.fetchBalance.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('свежий топ повторно не собирается', async () => {
    const store = useTopAccountsStore()
    await store.load()
    await store.load()
    expect(mocks.fetchTop).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('ready')
  })

  it('не собрался и списка нет — ошибка', async () => {
    mocks.fetchTop.mockRejectedValueOnce(new Error('offline'))
    const store = useTopAccountsStore()
    await store.load()
    expect(store.status).toBe('error')
  })

  it('по PKOIN: по убыванию баланса, без ответа ноды — в конце; дважды не спрашиваем', async () => {
    mocks.fetchBalance.mockImplementation(async (address: string) => {
      if (address === 'B') throw new Error('timeout')
      return address === 'A' ? 5 : 900
    })
    const store = useTopAccountsStore()
    await store.load()
    await store.ensureBalances(['A', 'B', 'C'])
    await store.ensureBalances(['A', 'B', 'C'])
    expect(mocks.fetchBalance).toHaveBeenCalledTimes(3)
    expect(store.byBalance.map((e) => e.address)).toEqual(['C', 'A', 'B'])
    expect(store.balances.B).toBeNull()
    expect(store.balancesDone).toBe(3)
  })
})
