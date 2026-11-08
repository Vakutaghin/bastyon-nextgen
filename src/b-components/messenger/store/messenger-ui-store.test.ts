// Ошибка синка в баннере: переводится вместе с интерфейсом, если язык сменили,
// пока она висит; строку по-прежнему можно присвоить как есть.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { i18n, setI18nLocale, t } from '@/i18n'
import { resetAppForegroundForTests, setAppActiveForTests } from '@/helpers/common/app-foreground'
import { SYNC_ERROR_GRACE_MS, useMessengerUiStore } from './messenger-ui-store'

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

describe('красная полоса ошибки синка', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('короткий обрыв — без полосы: телефон вернулся из фона, связь через миг есть', async () => {
    const ui = useMessengerUiStore()
    ui.syncError = 'нет связи'
    await vi.advanceTimersByTimeAsync(1_000)
    expect(ui.shownSyncError).toBeNull()
    ui.syncError = null
    await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS)
    expect(ui.shownSyncError).toBeNull()
  })

  it('ошибка держится — полоса встаёт и гаснет вместе с ней', async () => {
    const ui = useMessengerUiStore()
    ui.syncError = 'нет связи'
    // SDK повторяет ERROR при каждой неудачной проверке связи — отсчёт не сначала.
    await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS / 2)
    ui.syncError = 'нет связи'
    await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS / 2)
    expect(ui.shownSyncError).toBe('нет связи')
    ui.syncError = null
    await vi.advanceTimersByTimeAsync(0)
    expect(ui.shownSyncError).toBeNull()
  })

  it('SDK проверил связь через 10 с, и она есть — полоса не мигает', async () => {
    const ui = useMessengerUiStore()
    ui.syncError = 'нет связи'
    // Следующая проверка — через 5–10 с после неудачной; при 8 с полоса успевала встать.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ui.shownSyncError).toBeNull()
    ui.syncError = null
    await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS)
    expect(ui.shownSyncError).toBeNull()
  })

  describe('возврат из фона', () => {
    beforeEach(() => resetAppForegroundForTests())
    afterEach(() => resetAppForegroundForTests())

    it('связь оборвалась в фоне — по возвращении полоса не встаёт до переподключения', async () => {
      const ui = useMessengerUiStore()
      setAppActiveForTests(false)
      ui.syncError = 'нет связи'
      await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS * 3)

      setAppActiveForTests(true)
      expect(ui.shownSyncError).toBeNull()
      // Переподключились через секунду — полосы так и не было.
      await vi.advanceTimersByTimeAsync(1_000)
      ui.syncError = null
      await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS)
      expect(ui.shownSyncError).toBeNull()
    })

    it('связи нет и после возвращения — полоса встаёт, отсчёт с возвращения', async () => {
      const ui = useMessengerUiStore()
      setAppActiveForTests(false)
      ui.syncError = 'нет связи'
      await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS * 3)

      setAppActiveForTests(true)
      await vi.advanceTimersByTimeAsync(SYNC_ERROR_GRACE_MS - 1)
      expect(ui.shownSyncError).toBeNull()
      await vi.advanceTimersByTimeAsync(1)
      expect(ui.shownSyncError).toBe('нет связи')
    })
  })
})
