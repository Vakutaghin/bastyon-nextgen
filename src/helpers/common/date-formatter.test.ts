import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { setI18nLocale } from '@/i18n'
import {
  formatTimeAgo,
  formatTimeCompact,
  formatDateTimeFull,
  formatDateTimeFromString,
  formatDateTimeExact,
  formatClock,
  formatLongDate,
} from './date-formatter'

const NOW = 1_700_000_000 // секунды
const MIN = 60
const HOUR = 3_600
const DAY = 86_400

beforeEach(() => setI18nLocale('ru'))
afterEach(() => setI18nLocale('ru'))

describe('formatTimeAgo — склонения делает Intl (S71)', () => {
  it('до пяти секунд — «только что»', () => {
    expect(formatTimeAgo(NOW - 3, NOW)).toBe('только что')
  })

  it('по-русски склоняет: 1 минуту, 2 минуты, 5 минут, 3 года', () => {
    expect(formatTimeAgo(NOW - MIN, NOW)).toBe('1 минуту назад')
    expect(formatTimeAgo(NOW - 2 * MIN, NOW)).toBe('2 минуты назад')
    expect(formatTimeAgo(NOW - 5 * MIN, NOW)).toBe('5 минут назад')
    // Раньше было «3 год назад».
    expect(formatTimeAgo(NOW - 3 * 365 * DAY, NOW)).toBe('3 года назад')
  })

  it('в английском интерфейсе — по-английски', () => {
    setI18nLocale('en')
    expect(formatTimeAgo(NOW - 2 * HOUR, NOW)).toBe('2 hours ago')
    expect(formatTimeAgo(NOW - DAY, NOW)).toBe('1 day ago')
  })
})

describe('formatTimeCompact — плотные списки', () => {
  it('короткие единицы из словаря', () => {
    expect(formatTimeCompact(NOW - 10, NOW)).toBe('только что')
    expect(formatTimeCompact(NOW - 5 * MIN, NOW)).toBe('5 мин.')
    expect(formatTimeCompact(NOW - 2 * HOUR, NOW)).toBe('2 ч.')
    expect(formatTimeCompact(NOW - 3 * DAY, NOW)).toBe('3 дн.')
  })

  it('старше недели — дата на языке интерфейса, а не браузера', () => {
    const ts = NOW - 14 * DAY
    expect(formatTimeCompact(ts, NOW)).toBe(new Date(ts * 1000).toLocaleDateString('ru'))
    setI18nLocale('en')
    expect(formatTimeCompact(ts, NOW)).toBe(new Date(ts * 1000).toLocaleDateString('en'))
  })
})

describe('formatDateTimeFull', () => {
  it('текущий год — без года', () => {
    const date = new Date()
    date.setMonth(0, 15)
    date.setHours(14, 30, 0, 0)
    const result = formatDateTimeFull(Math.floor(date.getTime() / 1000))
    expect(result).toContain('15 января')
    expect(result).toContain('14:30')
    expect(result).not.toContain(String(date.getFullYear()))
  })

  it('прошлый год — с годом', () => {
    const result = formatDateTimeFull(Math.floor(new Date(2020, 5, 3, 9, 5).getTime() / 1000))
    expect(result).toContain('2020')
    expect(result).toContain('09:05')
  })

  it('в английском интерфейсе месяц по-английски (раньше был всегда русский)', () => {
    setI18nLocale('en')
    const result = formatDateTimeFull(Math.floor(new Date(2020, 5, 3, 9, 5).getTime() / 1000))
    expect(result).toContain('June')
  })

  it('пустое и битое — пустая строка', () => {
    expect(formatDateTimeFull(0)).toBe('')
    expect(formatDateTimeFull(NaN)).toBe('')
  })
})

describe('formatDateTimeFromString', () => {
  it('принимает ISO-строку и миллисекунды', () => {
    expect(formatDateTimeFromString('2020-06-15T14:30:00Z')).toContain('2020')
    expect(formatDateTimeFromString(Date.UTC(2020, 5, 15))).toContain('2020')
  })

  it('битая строка — пустая', () => {
    expect(formatDateTimeFromString('not-a-date')).toBe('')
  })
})

describe('остальные форматы — на языке интерфейса', () => {
  const ms = new Date(2024, 2, 12, 14, 30, 5).getTime()

  it('formatDateTimeExact — числовая дата с секундами', () => {
    expect(formatDateTimeExact(ms / 1000)).toBe(
      new Date(ms).toLocaleString('ru', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    )
  })

  it('formatClock и formatLongDate', () => {
    expect(formatClock(ms)).toBe('14:30')
    expect(formatLongDate(ms)).toContain('12 марта 2024')
    setI18nLocale('en')
    expect(formatLongDate(ms)).toBe('March 12, 2024')
  })

  it('битые метки — пустая строка, а не «Invalid Date»', () => {
    expect(formatClock(NaN)).toBe('')
    expect(formatLongDate(NaN)).toBe('')
  })
})
