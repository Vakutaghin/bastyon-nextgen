import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime, formatRelativeTimeMs, formatDate } from './date-formatter'

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
