// Подборка «Новое от подписок», пришедшая к уже показанной ленте, наверх не
// встаёт до «Обновить».

import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => ({ address: '' }) }))
vi.mock('@tanstack/vue-query', () => ({ useQuery: () => ({ data: ref(), refetch: vi.fn() }) }))

import { HIGHLIGHTS_GRACE_MS, useLateArrivalGate } from './use-subscription-highlights'

describe('useLateArrivalGate', () => {
  afterEach(() => vi.useRealTimers())

  function setup() {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] })
    const shown = ref(false)
    const arrived = ref(false)
    const gate = useLateArrivalGate(
      () => shown.value,
      () => arrived.value
    )
    return { shown, arrived, gate }
  }

  it('came together with the feed or right after it: shown on top', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    vi.setSystemTime(1_000_000 + HIGHLIGHTS_GRACE_MS - 100)
    arrived.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(false)
  })

  it('came long after the feed: waits for Refresh, then goes on top', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    vi.setSystemTime(1_000_000 + 60_000)
    arrived.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(true)

    gate.reset()
    expect(gate.deferred.value).toBe(false)
  })

  it('the feed left the screen (another tab): the countdown starts over', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    vi.setSystemTime(1_000_000 + 60_000)
    shown.value = false
    await nextTick()
    arrived.value = true
    await nextTick()
    shown.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(false)
  })

  // Гость давно смотрит ленту и входит: лента та же (запрос от адреса не
  // зависит), а подборка нового аккаунта приходит после входа.
  it('signed in over a feed shown long ago: the countdown starts at sign-in', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    vi.setSystemTime(1_000_000 + 60_000)
    gate.restart()
    vi.setSystemTime(1_000_000 + 60_000 + HIGHLIGHTS_GRACE_MS - 100)
    arrived.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(false)
  })

  it('after sign-in a selection that is late anyway still waits for Refresh', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    gate.restart()
    vi.setSystemTime(1_000_000 + 60_000)
    arrived.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(true)
  })

  it('a deferred selection of the previous account does not hold back the next one', async () => {
    const { shown, arrived, gate } = setup()
    shown.value = true
    await nextTick()
    vi.setSystemTime(1_000_000 + 60_000)
    arrived.value = true
    await nextTick()
    expect(gate.deferred.value).toBe(true)
    gate.restart()
    expect(gate.deferred.value).toBe(false)
  })
})
