import { beforeEach, describe, expect, it, vi } from 'vitest'

// Хранилище — карта в памяти, нода — счётчики вызовов. Вершина на сутках 25:
// куски 0 и 1 закончены, кусок 2 (сутки 20–29) ещё идёт.
const mocks = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  chunkCalls: [] as number[],
  hourCalls: 0,
  accountCalls: 0,
  failChunks: new Set<number>(),
}))

vi.mock('@/composables/use-block-explorer-queries', () => ({ useNodeInfo: () => ({}) }))
vi.mock('./stats-source', async (importOriginal) => {
  const real = await importOriginal<typeof import('./stats-source')>()
  return {
    ...real,
    fetchDayChunk: async (k: number) => {
      mocks.chunkCalls.push(k)
      if (mocks.failChunks.has(k)) throw new Error('timeout')
      return { [String(k * 10)]: { '200': k + 1 } }
    },
    fetchHours: async () => {
      mocks.hourCalls++
      return { '1': { '300': 5 } }
    },
    fetchAccountsByHour: async () => {
      mocks.accountCalls++
      return { '1': 100, '2': 101 }
    },
    readHistory: async (keys: readonly string[]) => {
      const out = new Map<string, unknown>()
      for (const key of keys) if (mocks.storage.has(key)) out.set(key, mocks.storage.get(key))
      return out
    },
    writeHistory: async (entries: ReadonlyMap<string, unknown>) => {
      for (const [key, value] of entries) mocks.storage.set(key, value)
    },
  }
})

import { DAY_BLOCKS, type ChainAnchor } from './chain-time'
import { resetStatsSyncForTests, startStatsSync, statsSyncState, syncStats } from './stats-sync'

const tipOnDay = (day: number): ChainAnchor => [day * DAY_BLOCKS + 5, 1_700_000_000]

function forgetCalls(): void {
  mocks.chunkCalls.length = 0
  mocks.hourCalls = 0
  mocks.accountCalls = 0
}

beforeEach(() => {
  resetStatsSyncForTests()
  mocks.storage.clear()
  mocks.failChunks.clear()
  forgetCalls()
})

describe('история статистики на устройстве', () => {
  it('первый раз собирается вся история, от свежих кусков к старым', async () => {
    await startStatsSync(tipOnDay(25))
    expect(mocks.chunkCalls).toEqual([2, 1, 0])
    expect(mocks.hourCalls).toBe(1)
    expect(mocks.accountCalls).toBe(1)
    expect(statsSyncState.days.value).toEqual({
      '0': { '200': 1 },
      '10': { '200': 2 },
      '20': { '200': 3 },
    })
    expect(statsSyncState.syncedAt.value).not.toBeNull()
    expect(statsSyncState.progress.value).toBeNull()
    // Законченные — навсегда, идущий — отдельно: его спросят при «Обновить».
    expect(mocks.storage.has('day-chunk:0')).toBe(true)
    expect(mocks.storage.has('day-chunk:1')).toBe(true)
    expect(mocks.storage.has('day-chunk:2')).toBe(false)
    expect(mocks.storage.has('day-open:2')).toBe(true)
  })

  it('после перезапуска всё поднимается без единого запроса', async () => {
    await startStatsSync(tipOnDay(25))
    const at = statsSyncState.syncedAt.value
    resetStatsSyncForTests()
    forgetCalls()

    await startStatsSync(tipOnDay(26))
    expect(mocks.chunkCalls).toEqual([])
    expect(mocks.hourCalls).toBe(0)
    expect(statsSyncState.syncedAt.value).toBe(at)
    expect(Object.keys(statsSyncState.days.value)).toEqual(['0', '10', '20'])
    expect(statsSyncState.hours.value).toEqual({ '1': { '300': 5 } })
  })

  it('«Обновить» спрашивает только то, что могло измениться', async () => {
    await startStatsSync(tipOnDay(25))
    forgetCalls()

    // Прошло шесть суток: кусок 2 закончился, начался кусок 3.
    await syncStats(tipOnDay(31))
    expect(mocks.chunkCalls).toEqual([3, 2])
    expect(mocks.hourCalls).toBe(1)
    expect(mocks.accountCalls).toBe(1)
    expect(mocks.storage.has('day-chunk:2')).toBe(true)
  })

  it('не пришедший кусок: без даты синхронизации, догружается в следующий раз', async () => {
    mocks.failChunks.add(1)
    await startStatsSync(tipOnDay(25))
    // Две попытки, потом — счётчик для «Повторить».
    expect(mocks.chunkCalls.filter((k) => k === 1)).toHaveLength(2)
    expect(statsSyncState.failed.value).toBe(1)
    expect(statsSyncState.syncedAt.value).toBeNull()
    expect(statsSyncState.days.value['0']).toBeDefined()

    mocks.failChunks.clear()
    forgetCalls()
    await syncStats(tipOnDay(25))
    expect(mocks.chunkCalls).toEqual([2, 1])
    expect(statsSyncState.failed.value).toBe(0)
    expect(statsSyncState.syncedAt.value).not.toBeNull()
  })

  it('прерванная синхронизация после перезапуска продолжается с того же места', async () => {
    mocks.failChunks.add(0)
    await startStatsSync(tipOnDay(25))
    resetStatsSyncForTests()
    mocks.failChunks.clear()
    forgetCalls()

    await startStatsSync(tipOnDay(25))
    expect(mocks.chunkCalls).toEqual([2, 0])
    expect(statsSyncState.syncedAt.value).not.toBeNull()
  })
})
