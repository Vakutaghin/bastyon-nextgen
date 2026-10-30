// Текст статуса собеседника: «в сети», «был(а) в сети … назад» или ничего.

import { beforeAll, describe, expect, it } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'
import { presenceLabel } from './use-partner-presence'

const t = (key: string, values?: Record<string, unknown>) =>
  i18n.global.t(key, values ?? {}) as string

beforeAll(() => setI18nLocale('ru'))

describe('presenceLabel', () => {
  const now = 1_700_000_000_000

  it('в сети', () => {
    expect(presenceLabel({ online: true, lastActiveAt: null }, t, now)).toBe('в сети')
  })

  it('был(а) в сети — с относительным временем', () => {
    expect(presenceLabel({ online: false, lastActiveAt: now - 5 * 60_000 }, t, now)).toBe(
      'был(а) в сети 5 минут назад'
    )
  })

  it('ничего не известно — ничего не показываем', () => {
    expect(presenceLabel(null, t, now)).toBeNull()
    expect(presenceLabel({ online: false, lastActiveAt: null }, t, now)).toBeNull()
  })
})
