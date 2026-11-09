import { expect, type Page } from '@playwright/test'

/** Перечитывание списка после новых профилей (PROFILE_UPDATE_DEBOUNCE) с запасом. */
export const PROFILE_RELOAD_SETTLE = 2_500

interface Profile {
  address: string
  name: string
}

/**
 * Мессенджер без сервера чатов (e2e закрывает `/_matrix`): вход падает и
 * очищает список, а новые профили собеседников в кэше перечитывают список —
 * тоже пустой. Подложенные тестом чаты пропадали посреди проверки (в WebKit —
 * почти всегда). Здесь: открыть мессенджер, дождаться сбоя входа, положить
 * профили собеседников и переждать перечитывание; после этого чаты в сторе
 * держатся.
 */
export async function settleOfflineMessenger(
  page: Page,
  profiles: readonly Profile[]
): Promise<void> {
  await page.evaluate(async () => {
    type Store = Record<string, (...a: unknown[]) => unknown>
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    await app.config.globalProperties.$pinia._s.get('messenger')!.openMessenger!()
  })
  await expect(page.getByText('Не удалось войти в мессенджер', { exact: false })).toBeVisible({
    timeout: 30_000,
  })
  await primeMessengerProfiles(page, profiles)
}

/**
 * Профили собеседников — в кэш мессенджера заранее и переждать перечитывание
 * списка, которое они запускают. Для тестов, где вход в мессенджер уже прошёл
 * своим путём (локальный архив): иначе перечитывание без сервера заменяет
 * подложенные чаты пустым списком.
 */
export async function primeMessengerProfiles(
  page: Page,
  profiles: readonly Profile[]
): Promise<void> {
  await page.evaluate((list) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, { userProfiles: Record<string, unknown> }> }
            }
          }
        }
      }
    ).__vue_app__
    const cache = app.config.globalProperties.$pinia._s.get('messenger-profile-cache')!
    for (const p of list) cache.userProfiles[p.address] = { ...p }
  }, profiles)
  await page.waitForTimeout(PROFILE_RELOAD_SETTLE)
}
