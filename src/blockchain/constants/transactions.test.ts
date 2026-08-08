import { describe, it, expect } from 'vitest'
import {
  AMOUNT_MULTIPLIER,
  DEFAULT_TX_FEE,
  DUST_VALUE,
  toSatoshis,
  fromSatoshis,
} from './transactions'

describe('transaction constants', () => {
  it('has correct amount multiplier', () => {
    expect(AMOUNT_MULTIPLIER).toBe(100_000_000)
  })

  it('has correct default tx fee', () => {
    expect(DEFAULT_TX_FEE).toBe(0.00000001)
  })

  it('has correct dust value', () => {
    expect(DUST_VALUE).toBe(0.000007)
  })
})

describe('toSatoshis', () => {
  it('converts 1 PKOIN to satoshis', () => {
    expect(toSatoshis(1)).toBe(100_000_000)
  })

  it('converts fractional PKOIN', () => {
    expect(toSatoshis(0.5)).toBe(50_000_000)
  })

  it('converts zero', () => {
    expect(toSatoshis(0)).toBe(0)
  })

  // P2-7: округляем float-погрешность, а не усекаем — иначе теряется 1 сатоши.
  it('rounds off float drift instead of truncating (P2-7)', () => {
    // 2.3 * 1e8 = 229999999.99999997 в float → Math.floor дал бы 229999999.
    expect(toSatoshis(2.3)).toBe(230_000_000)
    // 0.29 * 1e8 = 28999999.999999996 → floor терял бы сатоши.
    expect(toSatoshis(0.29)).toBe(29_000_000)
  })
})

describe('fromSatoshis', () => {
  it('converts satoshis to PKOIN', () => {
    expect(fromSatoshis(100_000_000)).toBe(1)
  })

  it('converts partial satoshis', () => {
    expect(fromSatoshis(50_000_000)).toBe(0.5)
  })

  it('converts zero', () => {
    expect(fromSatoshis(0)).toBe(0)
  })
})
