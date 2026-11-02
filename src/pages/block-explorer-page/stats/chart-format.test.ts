import { describe, expect, it } from 'vitest'
import {
  axisTimeFormatter,
  formatCompact,
  formatPeriod,
  formatTicks,
  formatValue,
} from './chart-format'

const T = new Date(2026, 9, 27, 14, 0).getTime()
const DAY = 86_400_000

describe('chart format', () => {
  it('period by step', () => {
    expect(formatPeriod(T, T + 3600_000, 'hour', 'en')).toMatch(/Oct 27.*2:00/)
    expect(formatPeriod(T, T + DAY, 'day', 'en')).toBe('Oct 27, 2026')
    expect(formatPeriod(T, T + 7 * DAY, 'week', 'en')).toMatch(/Oct 27\s*–\s*Nov 2, 2026/)
    expect(formatPeriod(T, T + 31 * DAY, 'month', 'ru')).toMatch(/октябрь 2026/i)
  })

  it('axis unit grows with the span', () => {
    const midnight = new Date(2026, 9, 28)
    expect(axisTimeFormatter(DAY, 'en')(midnight)).toBe('Oct 28')
    expect(axisTimeFormatter(DAY, 'en')(new Date(T))).toMatch(/2:00/)
    expect(axisTimeFormatter(400 * DAY, 'en')(new Date(2026, 0, 1))).toBe('2026')
    expect(axisTimeFormatter(400 * DAY, 'en')(new Date(2026, 4, 1))).toBe('May')
    expect(axisTimeFormatter(2000 * DAY, 'en')(new Date(2026, 4, 1))).toBe('2026')
  })

  it('numbers', () => {
    expect(formatCompact(15300, 'en')).toBe('15.3K')
    expect(formatValue(12345.6, 'en')).toBe('12,346')
    expect(formatValue(3.456, 'en', 2)).toBe('3.46')
    expect(formatValue(null, 'en')).toBe('—')
    expect(formatTicks([0, 20000, 40000], 'en')).toEqual(['0', '20K', '40K'])
    expect(formatTicks([18_760_000, 18_780_000, 18_800_000], 'en')).toEqual([
      '18.76M',
      '18.78M',
      '18.8M',
    ])
  })
})
