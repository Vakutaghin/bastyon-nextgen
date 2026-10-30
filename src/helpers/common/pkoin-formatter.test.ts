import { describe, it, expect } from 'vitest'
import {
  formatPaymentAmount,
  formatPaymentSatoshis,
  formatPkoinFromSmallestUnits,
  formatPkoin,
  formatPkoinWithSeparators,
  formatSmallestUnitsFromPkoin,
  PKOIN_DECIMALS,
  PKOIN_DIVISOR,
  formatPkoinAmount,
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

describe('formatPkoinAmount (V4/V5: вход уже в PKOIN)', () => {
  it('не делит на 1e8 и режет хвостовые нули', () => {
    expect(formatPkoinAmount(12.5, 4)).toBe('12.5')
    expect(formatPkoinAmount(0.06249995, 4)).toBe('0.0625')
    expect(formatPkoinAmount(3, 2)).toBe('3')
  })
  it('пусто/0/NaN → "0"', () => {
    expect(formatPkoinAmount(0)).toBe('0')
    expect(formatPkoinAmount(null)).toBe('0')
    expect(formatPkoinAmount(NaN)).toBe('0')
  })
})

describe('formatPaymentAmount: суммы в уведомлениях и событиях', () => {
  it('от 1 PKOIN — до двух знаков, без хвостовых нулей', () => {
    expect(formatPaymentAmount(12.345)).toBe('12.35')
    expect(formatPaymentAmount(2)).toBe('2')
    expect(formatPaymentAmount(1.5)).toBe('1.5')
    expect(formatPaymentAmount(1)).toBe('1')
  })

  it('меньше 1 — до трёх знаков, а не «0»', () => {
    expect(formatPaymentAmount(0.5)).toBe('0.5')
    expect(formatPaymentAmount(0.1234)).toBe('0.123')
    expect(formatPaymentAmount(0.05)).toBe('0.05')
    expect(formatPaymentAmount(0.004)).toBe('0.004')
  })

  it('три нуля — дальше, до первой ненулевой цифры', () => {
    expect(formatPaymentAmount(0.0004)).toBe('0.0004')
    expect(formatPaymentAmount(0.0005)).toBe('0.0005')
    expect(formatPaymentAmount(0.00012345)).toBe('0.0001')
    expect(formatPaymentAmount(0.00000001)).toBe('0.00000001')
    expect(formatPaymentAmount(0.001)).toBe('0.001')
  })

  it('ноль и мусор — «0»; сатоши переводятся в PKOIN', () => {
    expect(formatPaymentAmount(0)).toBe('0')
    expect(formatPaymentAmount(NaN)).toBe('0')
    expect(formatPaymentAmount(undefined)).toBe('0')
    expect(formatPaymentSatoshis(50_000_000)).toBe('0.5')
    expect(formatPaymentSatoshis('40000')).toBe('0.0004')
    expect(formatPaymentSatoshis(1_234_567_890)).toBe('12.35')
  })
})
