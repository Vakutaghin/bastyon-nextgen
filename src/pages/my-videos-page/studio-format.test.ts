// Числа «Медиастудии» по правилам языка: время просмотра, размер, короткие числа.

import { beforeAll, describe, expect, it } from 'vitest'

import { setI18nLocale } from '@/i18n'
import { formatCompact, formatCount, formatSize, formatWatchTime } from './studio-format'

// Intl разделяет разряды неразрывным пробелом — сравниваем с обычным.
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ')

describe('studio-format (ru)', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })

  it('время просмотра: часы и минуты, минуты и секунды, только секунды', () => {
    expect(plain(formatWatchTime(3900))).toBe('1 ч 5 мин')
    expect(plain(formatWatchTime(3600))).toBe('1 ч')
    expect(plain(formatWatchTime(75))).toBe('1 мин 15 с')
    expect(plain(formatWatchTime(12.4))).toBe('12 с')
    expect(plain(formatWatchTime(-5))).toBe('0 с')
  })

  it('размер в КБ/МБ/ГБ: до 10 — с десятой', () => {
    expect(plain(formatSize(31_457_280))).toBe('30 МБ')
    expect(plain(formatSize(1_288_490_189))).toBe('1,2 ГБ')
    expect(plain(formatSize(512))).toBe('512 Б')
  })

  it('числа: целиком с разрядами и коротко', () => {
    expect(plain(formatCount(1234))).toBe('1 234')
    expect(plain(formatCompact(1234))).toBe('1,2 тыс.')
    expect(plain(formatCompact(87))).toBe('87')
  })
})
