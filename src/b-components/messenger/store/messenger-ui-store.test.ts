// Ошибка синка в баннере: переводится вместе с интерфейсом, если язык сменили,
// пока она висит; строку по-прежнему можно присвоить как есть.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { i18n, setI18nLocale, t } from '@/i18n'
import { useMessengerUiStore } from './messenger-ui-store'

const initial = i18n.global.locale.value as 'ru' | 'en'

beforeEach(() => {
  setActivePinia(createPinia())
  setI18nLocale('ru')
})

afterEach(() => {
  setI18nLocale(initial)
})

describe('ошибка синка', () => {
  it('сменили язык — баннер на новом языке', () => {
    const ui = useMessengerUiStore()
    ui.setSyncError(() => t('appMsg.messenger.loginFailed'))
    expect(ui.syncError).toMatch(/^Не удалось войти в мессенджер/)
    setI18nLocale('en')
    expect(ui.syncError).not.toMatch(/[а-я]/)
    expect(ui.syncError).toBe(t('appMsg.messenger.loginFailed'))
  })

  it('строку присваивают и сбрасывают как раньше', () => {
    const ui = useMessengerUiStore()
    ui.syncError = 'нет связи'
    expect(ui.syncError).toBe('нет связи')
    ui.reset()
    expect(ui.syncError).toBeNull()
  })
})
