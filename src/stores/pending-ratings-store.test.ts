// X9/V32: pending-оценки привязаны к адресу — reset останавливает поллинг,
// poll не шлёт getpagescores(postIds_A, B).

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getUserAddress: 'PA' as string | null },
  getActiveByUser: vi.fn(async () => [
    { shareId: 'tx1', ratingValue: 5, expiresAt: Date.now() + 60_000 },
  ]),
  cleanupExpired: vi.fn(async () => {}),
  rpc: vi.fn<(p: { parameters: unknown[] }) => Promise<unknown[]>>(async () => []),
}))
vi.mock('@/stores', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/posts-store', () => ({
  usePostsStore: () => ({ getPostByShareId: () => null, updatePost: vi.fn() }),
}))
vi.mock('@/db/apis/post-rating-pending-api', () => ({
  postRatingPendingAPI: {
    getActiveByUser: mocks.getActiveByUser,
    cleanupExpired: mocks.cleanupExpired,
    addPending: vi.fn(async () => {}),
    markSubmitted: vi.fn(async () => {}),
    markConfirmed: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
  },
}))
vi.mock('@/helpers/api/request', () => ({ rpcCallArrayWithAuth: mocks.rpc }))

import { usePendingRatingsStore } from './pending-ratings-store'

describe('pending-ratings-store × смена аккаунта', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mocks.auth.getUserAddress = 'PA'
    mocks.rpc.mockClear()
  })
  afterEach(() => {
    usePendingRatingsStore().reset()
    vi.useRealTimers()
  })

  it('init поднимает оценки адреса и запускает поллинг; reset останавливает его', async () => {
    const store = usePendingRatingsStore()
    await store.init()
    expect(store.count).toBe(1)
    expect(store.initedForAddress).toBe('PA')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc.mock.calls[0]![0].parameters).toEqual([['tx1'], 'PA', []])

    store.reset()
    expect(store.count).toBe(0)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('poll не уходит с postIds прежнего аккаунта под новым адресом', async () => {
    const store = usePendingRatingsStore()
    await store.init()
    mocks.auth.getUserAddress = 'PB' // адрес сменился, reset ещё не дошёл
    await vi.advanceTimersByTimeAsync(5_000)
    expect(mocks.rpc).not.toHaveBeenCalled()

    // Повторный init для B перечитывает IDB под его адресом.
    await store.init()
    expect(store.initedForAddress).toBe('PB')
    expect(mocks.getActiveByUser).toHaveBeenLastCalledWith('PB')
  })
})

describe('pending-ratings-store × порядок записей IDB (N10)', () => {
  it('markFailed ждёт незавершённый add — строка не остаётся фантомным pending', async () => {
    setActivePinia(createPinia())
    mocks.auth.getUserAddress = 'PA'
    const { postRatingPendingAPI } = await import('@/db/apis/post-rating-pending-api')
    const calls: string[] = []
    let releaseAdd: () => void = () => {}
    vi.mocked(postRatingPendingAPI.addPending).mockImplementationOnce(
      () =>
        new Promise((r) => {
          releaseAdd = () => {
            calls.push('add')
            r({} as never)
          }
        })
    )
    vi.mocked(postRatingPendingAPI.markFailed).mockImplementationOnce(async () => {
      calls.push('markFailed')
    })
    const store = usePendingRatingsStore()
    void store.add('tx9', 5, 60_000)
    const failed = store.markFailed('tx9', 'boom')
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toEqual([]) // markFailed не обогнал add
    releaseAdd()
    await failed
    expect(calls).toEqual(['add', 'markFailed'])
    expect(store.count).toBe(0)
  })
})
