// Стор топа: свежий топ не собирается заново, устаревший — собирается, а
// прежний список виден, пока идёт сбор; неудачная сборка без прежнего списка —
// ошибка; один и тот же профиль не запрашивается дважды.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchTop: vi.fn(),
  fetchProfiles: vi.fn(async (_addresses: readonly string[]) => [] as unknown[]),
}))
vi.mock('@/services/top-accounts', () => ({
  fetchTopByReputation: mocks.fetchTop,
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
    mocks.fetchProfiles.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('свежий топ повторно не собирается', async () => {
    const store = useTopAccountsStore()
    await store.load()
    await store.load()
    expect(mocks.fetchTop).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('ready')
  })

  it('через полчаса собирается заново, а прежний список виден до конца сбора', async () => {
    vi.useFakeTimers()
    try {
      const store = useTopAccountsStore()
      await store.load()
      vi.advanceTimersByTime(31 * 60 * 1000)
      let finish: (value: unknown) => void = () => {}
      mocks.fetchTop.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      const reload = store.load()
      expect(store.status).toBe('ready')
      expect(store.entries).toHaveLength(3)
      finish({ entries: [ENTRIES[2]], profiles: [] })
      await reload
      expect(mocks.fetchTop).toHaveBeenCalledTimes(2)
      expect(store.entries.map((e) => e.address)).toEqual(['C'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('не собрался и списка нет — ошибка', async () => {
    mocks.fetchTop.mockRejectedValueOnce(new Error('offline'))
    const store = useTopAccountsStore()
    await store.load()
    expect(store.status).toBe('error')
  })

  it('профили: только неизвестные, и пока запрос в пути — не повторно', async () => {
    mocks.fetchProfiles.mockImplementation(async (addresses: readonly string[]) =>
      addresses.map((address) => ({ address, name: `n-${address}` }))
    )
    const store = useTopAccountsStore()
    await store.load()
    await Promise.all([store.ensureProfiles(['A', 'B']), store.ensureProfiles(['A', 'B'])])
    await store.ensureProfiles(['A', 'B', 'C'])
    expect(mocks.fetchProfiles.mock.calls.map(([a]) => a)).toEqual([['A', 'B'], ['C']])
    expect(store.profiles.C?.name).toBe('n-C')
  })
})
