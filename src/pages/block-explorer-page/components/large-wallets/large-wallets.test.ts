import { describe, it, expect } from 'vitest'
import {
  ACTIVE_CANDIDATES,
  BALANCE_CACHE_KEY,
  BALANCE_CACHE_LIMIT,
  BALANCE_FRESH_MS,
  STAKER_CACHE_KEY,
  STAKER_CACHE_LIMIT,
  buildWalletRows,
  countStakes,
  emissionShare,
  formatShare,
  isBalanceStale,
  mergeCandidates,
  readBalanceCache,
  readStakerCache,
  totalBalance,
  writeBalanceCache,
  writeStakerCache,
} from './large-wallets'
import type { ActiveAddress } from '../top-addresses/aggregate-active-addresses'

/** Хранилище в памяти; `broken` — как в приватном окне: всё бросает. */
function memoryStorage(broken = false) {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key: string): string | null {
      if (broken) throw new Error('SecurityError')
      return data.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      if (broken) throw new Error('QuotaExceededError')
      data.set(key, value)
    },
  }
}

function active(address: string): ActiveAddress {
  return { address, appearances: 1, txCount: 1, volumeIn: 0, volumeOut: 0 }
}

describe('staker cache', () => {
  it('round-trips and keeps only the latest entries', () => {
    const storage = memoryStorage()
    const cache = new Map<string, string>()
    for (let i = 0; i < STAKER_CACHE_LIMIT + 5; i++) cache.set(`h${i}`, `P${i % 7}`)
    writeStakerCache(storage, cache)
    const back = readStakerCache(storage)
    expect(back.size).toBe(STAKER_CACHE_LIMIT)
    expect(back.has('h0')).toBe(false)
    expect(back.get(`h${STAKER_CACHE_LIMIT + 4}`)).toBe(`P${(STAKER_CACHE_LIMIT + 4) % 7}`)
  })

  it('survives garbage, missing and broken storage', () => {
    const storage = memoryStorage()
    storage.data.set(STAKER_CACHE_KEY, '{not json')
    expect(readStakerCache(storage).size).toBe(0)
    storage.data.set(STAKER_CACHE_KEY, JSON.stringify([['h1', 'PA'], ['h2', ''], [3, 'PB'], 'x']))
    expect([...readStakerCache(storage)]).toEqual([['h1', 'PA']])
    expect(readStakerCache(null).size).toBe(0)
    const broken = memoryStorage(true)
    expect(readStakerCache(broken).size).toBe(0)
    expect(() => writeStakerCache(broken, new Map([['h', 'P']]))).not.toThrow()
  })
})

describe('balance cache', () => {
  it('round-trips, drops bad rows and is bounded', () => {
    const storage = memoryStorage()
    const cache = new Map<string, { balance: number; at: number }>()
    for (let i = 0; i < BALANCE_CACHE_LIMIT + 3; i++) cache.set(`P${i}`, { balance: i, at: 1000 })
    writeBalanceCache(storage, cache)
    const back = readBalanceCache(storage)
    expect(back.size).toBe(BALANCE_CACHE_LIMIT)
    expect(back.get(`P${BALANCE_CACHE_LIMIT + 2}`)).toEqual({
      balance: BALANCE_CACHE_LIMIT + 2,
      at: 1000,
    })

    storage.data.set(
      BALANCE_CACHE_KEY,
      JSON.stringify([
        ['PA', 5, 1],
        ['PB', 'x', 1],
        ['PC', 1],
      ])
    )
    expect([...readBalanceCache(storage)]).toEqual([['PA', { balance: 5, at: 1 }]])
  })

  it('a balance is stale when unknown or older than ten minutes', () => {
    const now = 10_000_000
    expect(isBalanceStale(undefined, now)).toBe(true)
    expect(isBalanceStale({ balance: 1, at: now - 1000 }, now)).toBe(false)
    expect(isBalanceStale({ balance: 1, at: now - BALANCE_FRESH_MS - 1 }, now)).toBe(true)
  })
})

describe('candidates and rows', () => {
  it('counts blocks per staker only within the checked window', () => {
    const stakers = new Map([
      ['h1', 'PA'],
      ['h2', 'PB'],
      ['h3', 'PA'],
      ['old', 'PC'],
    ])
    expect([...countStakes(['h1', 'h2', 'h3', 'h4'], stakers)]).toEqual([
      ['PA', 2],
      ['PB', 1],
    ])
  })

  it('merges stakers with the most active addresses without duplicates', () => {
    const many = Array.from({ length: ACTIVE_CANDIDATES + 5 }, (_, i) => active(`PX${i}`))
    const out = mergeCandidates(new Map([['PA', 3]]), [active('PA'), active(''), ...many])
    expect(out[0]).toEqual({ address: 'PA', stakedBlocks: 3, active: true })
    // PA и пустой адрес заняли два места из первых ACTIVE_CANDIDATES.
    expect(out).toHaveLength(1 + ACTIVE_CANDIDATES - 2)
    expect(out.every((c) => c.address)).toBe(true)
    expect(mergeCandidates(new Map(), null)).toEqual([])
  })

  it('rows: only known balances, richest first, share of emission', () => {
    const candidates = [
      { address: 'PSmall', stakedBlocks: 1, active: false },
      { address: 'PBig', stakedBlocks: 14, active: false },
      { address: 'PNoBalance', stakedBlocks: 5, active: false },
      { address: 'PTieA', stakedBlocks: 0, active: true },
      { address: 'PTieB', stakedBlocks: 2, active: false },
    ]
    const balances = new Map([
      ['PSmall', 27.62],
      ['PBig', 778950.01],
      ['PTieA', 100],
      ['PTieB', 100],
    ])
    const rows = buildWalletRows(candidates, balances, 18_850_025)
    expect(rows.map((r) => r.address)).toEqual(['PBig', 'PTieB', 'PTieA', 'PSmall'])
    expect(rows[0]!.share).toBeCloseTo(4.1323, 3)
    expect(totalBalance(rows)).toBeCloseTo(779177.63, 2)
    expect(buildWalletRows(candidates, balances, null)[0]!.share).toBeNull()
  })

  it('emission share and its label', () => {
    expect(emissionShare(1, 0)).toBeNull()
    expect(emissionShare(-1, 100)).toBeNull()
    expect(emissionShare(25, 100)).toBe(25)
    expect(formatShare(4.1323)).toBe('4.13%')
    expect(formatShare(23.5)).toBe('23.5%')
    expect(formatShare(10)).toBe('10%')
    expect(formatShare(0.0004)).toBe('<0.01%')
    expect(formatShare(0)).toBe('0%')
    expect(formatShare(null)).toBe('—')
  })
})
