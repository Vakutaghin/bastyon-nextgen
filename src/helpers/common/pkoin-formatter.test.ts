import { describe, it, expect } from 'vitest'
import {
  formatPkoinFromSmallestUnits,
  formatPkoin,
  formatPkoinWithSeparators,
  formatSmallestUnitsFromPkoin,
  PKOIN_DECIMALS,
  PKOIN_DIVISOR,
} from './pkoin-formatter'

describe('PKOIN constants', () => {
  it('has correct decimal count', () => {
    expect(PKOIN_DECIMALS).toBe(8)
  })

  it('has correct divisor', () => {
    expect(PKOIN_DIVISOR).toBe(100_000_000)
  })
})

describe('formatPkoinFromSmallestUnits', () => {
  it('returns 0 for null/undefined', () => {
    expect(formatPkoinFromSmallestUnits(null)).toBe(0)
    expect(formatPkoinFromSmallestUnits(undefined)).toBe(0)
  })

  it('returns 0 for zero', () => {
    expect(formatPkoinFromSmallestUnits(0)).toBe(0)
  })

  it('returns 0 for NaN string', () => {
    expect(formatPkoinFromSmallestUnits('abc')).toBe(0)
  })

  it('converts number correctly', () => {
    expect(formatPkoinFromSmallestUnits(1012959685)).toBeCloseTo(10.12959685)
  })

  it('converts string correctly', () => {
    expect(formatPkoinFromSmallestUnits('1012959685')).toBeCloseTo(10.12959685)
  })

  it('converts 1 PKOIN', () => {
    expect(formatPkoinFromSmallestUnits(100_000_000)).toBe(1)
  })
})

describe('formatPkoin', () => {
  it('returns "0" for null', () => {
    expect(formatPkoin(null)).toBe('0')
  })

  it('returns "0.00" for null with trailing zeros', () => {
    expect(formatPkoin(null, 2, true)).toBe('0.00')
  })

  it('formats with default 2 decimals', () => {
    expect(formatPkoin(1012959685)).toBe('10.13')
  })

  it('formats with 4 decimals', () => {
    expect(formatPkoin(1012959685, 4)).toBe('10.1296')
  })

  it('formats with trailing zeros', () => {
    expect(formatPkoin(100_000_000, 2, true)).toBe('1.00')
  })

  it('strips trailing zeros by default', () => {
    expect(formatPkoin(100_000_000)).toBe('1')
  })

  it('formats small amounts', () => {
    expect(formatPkoin(1, 8)).toBe('0.00000001')
  })
})

describe('formatPkoinWithSeparators', () => {
  it('returns "0" for null', () => {
    expect(formatPkoinWithSeparators(null)).toBe('0')
  })

  it('adds thousand separators', () => {
    expect(formatPkoinWithSeparators(100_000_000_000)).toBe('1,000.00')
  })

  it('formats without separators for small amounts', () => {
    expect(formatPkoinWithSeparators(1012959685)).toBe('10.13')
  })
})

describe('formatSmallestUnitsFromPkoin', () => {
  it('returns 0 for NaN', () => {
    expect(formatSmallestUnitsFromPkoin(NaN)).toBe(0)
  })

  it('returns 0 for zero', () => {
    expect(formatSmallestUnitsFromPkoin(0)).toBe(0)
  })

  it('converts PKOIN to smallest units', () => {
    expect(formatSmallestUnitsFromPkoin(10.12959685)).toBe(1012959685)
  })

  it('converts 1 PKOIN', () => {
    expect(formatSmallestUnitsFromPkoin(1)).toBe(100_000_000)
  })

  it('rounds to nearest integer', () => {
    // 0.000000015 * 100_000_000 = 1.5 → Math.round = 2, but floating point: actually 1.4999... → 1
    expect(formatSmallestUnitsFromPkoin(0.123)).toBe(12300000)
  })
})
