// «Общие» → «Статистика»: в сборке с адресом сервера анонимная статистика
// включена по умолчанию, подпись прямо говорит об анонимности, переключатель
// выключает её и сохраняет выбор. Без адреса раздела нет.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({ stored: new Map<string, unknown>() }))
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    get: vi.fn(async (key: string) => h.stored.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      h.stored.set(key, value)
      return key
    }),
  },
}))
vi.mock('@/db/apis/decrypted-messages-api', () => ({ clearAllDecrypted: vi.fn() }))

import { APP_PREFERENCES_KEY, useAppPreferencesStore } from '@/stores/app-preferences-store'
import GeneralTab from './general-tab.vue'

let wrapper: VueWrapper | null = null

describe('GeneralTab — анонимная статистика', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    h.stored.clear()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.unstubAllEnvs()
  })

  it('без адреса сервера в сборке раздела нет', async () => {
    vi.stubEnv('VITE_USAGE_STATS_URL', '')
    wrapper = mount(GeneralTab, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="usage-stats-setting"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Анонимная статистика')
  })

  it('включена по умолчанию, подписана как анонимная и выключается', async () => {
    vi.stubEnv('VITE_USAGE_STATS_URL', 'https://stats.example:8460/beat')
    wrapper = mount(GeneralTab, { global: { plugins: [i18n] } })
    await flushPromises()

    const row = wrapper.get('[data-testid="usage-stats-setting"]')
    expect(row.text()).toContain('Анонимная статистика использования')
    expect(row.text()).toContain('Абсолютно анонимно')
    const toggle = row.get('[role="switch"]')
    expect(toggle.attributes('aria-checked')).toBe('true')

    await toggle.trigger('click')
    await flushPromises()
    expect(useAppPreferencesStore().usageStats).toBe(false)
    expect(h.stored.get(APP_PREFERENCES_KEY)).toMatchObject({ usageStats: false })
  })
})
