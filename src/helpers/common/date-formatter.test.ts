import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { setI18nLocale } from '@/i18n'
import {
  formatRelativeTime,
  formatRelativeTimeMs,
  formatDate,
  formatDateTimeFull,
  formatDateTimeFromString,
} from './date-formatter'

// formatRelativeTime теперь резолвит относительное время через i18n; фиксируем
// локаль 'ru', т.к. ассерты ниже сравнивают с русскими строками (в тест-окружении
// navigator.language → en, иначе вернулся бы английский).
beforeAll(() => setI18nLocale('ru'))

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "только что" for recent timestamps', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(formatRelativeTime(now)).toBe('только что')
  })

  it('returns minutes for < 60 min', () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 5 * 60
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 мин.')
  })

  it('returns hours for < 24 hours', () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 3600
    expect(formatRelativeTime(twoHoursAgo)).toBe('2 ч.')
  })

  it('returns days for < 7 days', () => {
    const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 86400
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 дн.')
  })

  it('returns localized date for > 7 days', () => {
    const twoWeeksAgo = Math.floor(Date.now() / 1000) - 14 * 86400
    const result = formatRelativeTime(twoWeeksAgo)
    // Should be a date string, not relative time
    expect(result).not.toContain('мин.')
    expect(result).not.toContain('ч.')
    expect(result).not.toContain('дн.')
  })
})

describe('formatRelativeTimeMs', () => {
  it('converts ms to seconds and delegates', () => {
    const now = Date.now()
    expect(formatRelativeTimeMs(now)).toBe('только что')
  })
})

describe('formatDate', () => {
  it('formats timestamp as localized date', () => {
    // 2024-03-12 in Unix seconds
    const timestamp = 1710244800
    const result = formatDate(timestamp)
    // Should contain year
    expect(result).toContain('2024')
  })
})

describe('formatDateTimeFull', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats current-year timestamp without year', () => {
    // Use a date in the current year
    const now = new Date()
    const thisYear = new Date(now.getFullYear(), 2, 15, 14, 30) // March 15 this year, 14:30
    const timestamp = Math.floor(thisYear.getTime() / 1000)
    const result = formatDateTimeFull(timestamp)
    // Should not contain the year since it is the current year
    expect(result).not.toContain(String(now.getFullYear()))
    // Should contain time portion
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('formats past-year timestamp with year', () => {
    // 2023-06-15 14:30:00 UTC
    const timestamp = Math.floor(new Date(2023, 5, 15, 14, 30).getTime() / 1000)
    const result = formatDateTimeFull(timestamp)
    expect(result).toContain('2023')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('returns empty string for 0', () => {
    expect(formatDateTimeFull(0)).toBe('')
  })

  it('returns empty string for NaN-producing input', () => {
    expect(formatDateTimeFull(NaN)).toBe('')
  })
})

describe('formatDateTimeFromString', () => {
  it('formats a date string', () => {
    const result = formatDateTimeFromString('2023-06-15T14:30:00Z')
    expect(result).toContain('2023')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('formats a millisecond timestamp', () => {
    const ms = new Date(2023, 5, 15, 14, 30).getTime()
    const result = formatDateTimeFromString(ms)
    expect(result).toContain('2023')
  })

  it('returns empty string for invalid input', () => {
    expect(formatDateTimeFromString('not-a-date')).toBe('')
  })
})
