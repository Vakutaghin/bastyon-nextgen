// Подписи строки меню macOS: все ключи есть, `{name}` доходит до Rust как есть.

import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import { appMenuLabels } from './use-tray-labels'

describe('appMenuLabels', () => {
  it('все пункты переведены, {name} — для названия приложения', () => {
    i18n.global.locale.value = 'ru'
    const ru = appMenuLabels()
    expect(ru.quit).toBe('Завершить {name}')
    expect(ru.copy).toBe('Скопировать')
    expect(Object.values(ru).every((v) => v && !v.startsWith('appMenu.'))).toBe(true)
    expect(Object.keys(ru)).toHaveLength(21)
  })
})
