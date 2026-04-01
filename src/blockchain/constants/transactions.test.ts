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

  it('floors the result', () => {
    expect(toSatoshis(0.000000015)).toBe(1)
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
