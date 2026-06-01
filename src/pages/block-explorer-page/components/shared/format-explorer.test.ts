import { describe, it, expect, beforeAll } from 'vitest'
import { setI18nLocale } from '@/i18n'
import {
  formatExplorerPkoin,
  formatExplorerNumber,
  shortenHash,
  formatRelativeTime,
} from './format-explorer'

// formatRelativeTime резолвит относительное время через i18n; фиксируем 'ru',
// т.к. ассерты ниже сравнивают с русскими строками.
beforeAll(() => setI18nLocale('ru'))

describe('formatExplorerPkoin', () => {
  it('strips trailing zeros by default', () => {
    expect(formatExplorerPkoin(1.5)).toBe('1.5')
    expect(formatExplorerPkoin(1.0)).toBe('1')
  })

  it('uses thousand separators in integer part', () => {
    expect(formatExplorerPkoin(1234567)).toBe('1,234,567')
    expect(formatExplorerPkoin(1234567.89)).toBe('1,234,567.89')
  })

  it('keeps full PKOIN precision when needed', () => {
    expect(formatExplorerPkoin(0.00001982)).toBe('0.00001982')
  })

  it('handles nullish and NaN', () => {
    expect(formatExplorerPkoin(null)).toBe('—')
    expect(formatExplorerPkoin(undefined)).toBe('—')
    expect(formatExplorerPkoin(NaN)).toBe('—')
    expect(formatExplorerPkoin(0)).toBe('0')
  })
})

describe('formatExplorerNumber', () => {
  it('inserts separators', () => {
    expect(formatExplorerNumber(3845575)).toBe('3,845,575')
    expect(formatExplorerNumber(0)).toBe('0')
  })

  it('handles nullish', () => {
    expect(formatExplorerNumber(null)).toBe('—')
    expect(formatExplorerNumber(undefined)).toBe('—')
  })
})

describe('shortenHash', () => {
  it('returns hash as-is when shorter than head+tail+1', () => {
    expect(shortenHash('abc')).toBe('abc')
  })

  it('shortens long hash with middle ellipsis', () => {
    const hash = '0e8fbe55d706ea5644a4523ae09740316895ce796b66b3de71e93de4c32ef0d4'
    expect(shortenHash(hash)).toBe('0e8fbe55…2ef0d4')
  })

  it('respects custom head/tail', () => {
    expect(shortenHash('1234567890abcdef', 4, 4)).toBe('1234…cdef')
  })
})

describe('formatRelativeTime', () => {
  it('renders "только что" for fresh times', () => {
    expect(formatRelativeTime(1000, 1003)).toBe('только что')
  })

  it('renders minutes', () => {
    expect(formatRelativeTime(0, 120)).toBe('2 мин назад')
  })

  it('renders hours', () => {
    expect(formatRelativeTime(0, 7200)).toBe('2 ч назад')
  })
})
