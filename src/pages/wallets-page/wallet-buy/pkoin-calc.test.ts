import { describe, expect, it } from 'vitest'
import { formatAmount, parseAmount, pkoinToUsd, usdToPkoin } from './pkoin-calc'

describe('калькулятор PKOIN ⇄ USD', () => {
  it('читает число с точкой, запятой и пробелами', () => {
    expect(parseAmount('100')).toBe(100)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount(' 1 000.25 ')).toBe(1000.25)
    expect(parseAmount('.5')).toBe(0.5)
  })

  it('не число — null', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('.')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
  })

  it('пишет сумму без хвостовых нулей и не трогает нули целой части', () => {
    expect(formatAmount(100, 2)).toBe('100')
    expect(formatAmount(13.9, 2)).toBe('13.9')
    expect(formatAmount(0, 8)).toBe('0')
    expect(formatAmount(719.42446043, 8)).toBe('719.42446043')
    expect(formatAmount(1.005, 0)).toBe('1')
    expect(formatAmount(Number.NaN, 2)).toBe('')
  })

  it('переводит по курсу в обе стороны', () => {
    expect(pkoinToUsd(100, 0.139)).toBeCloseTo(13.9)
    expect(usdToPkoin(13.9, 0.139)).toBeCloseTo(100)
    expect(usdToPkoin(10, 0)).toBe(0)
  })
})
