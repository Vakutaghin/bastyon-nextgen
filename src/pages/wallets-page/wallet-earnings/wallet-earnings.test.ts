// Вкладка «Заработок»: три суммы от ноды и под ними карточка «Монетизация для
// авторов» — ссылка на страницу со схемой программы, при любом состоянии сумм.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const state = vi.hoisted(() => ({
  earnings: null as unknown,
  isLoading: false,
  error: null as unknown,
}))

vi.mock('@/composables/use-wallet-queries', () => ({
  useAccountEarnings: () => ({
    earnings: ref(state.earnings),
    isLoading: ref(state.isLoading),
    error: ref(state.error),
  }),
}))

import WalletEarnings from './wallet-earnings.vue'

const Page = { template: '<div />' }
let router: Router
let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  wrapper = mount(WalletEarnings, { global: { plugins: [i18n, router] } })
  await router.isReady()
  return wrapper
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(async () => {
  setActivePinia(createPinia())
  state.earnings = { lottery: 1.5, donation: 0, transfer: 12.25 }
  state.isLoading = false
  state.error = null
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/wallets', name: 'wallets', component: Page },
      { path: '/monetization', name: 'monetization', component: Page },
    ],
  })
  await router.push('/wallets')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('вкладка «Заработок»', () => {
  it('суммы и под ними карточка монетизации, ведущая на её страницу', async () => {
    const w = await render()
    expect(w.text()).toContain('12.25')
    const banner = w.get('[data-testid="earnings-monetization"]')
    expect(banner.text()).toContain('Монетизация для авторов')
    expect(banner.attributes('href')).toBe('/monetization')

    await banner.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('monetization')
  })

  it('карточка есть и пока суммы не загрузились', async () => {
    state.earnings = null
    state.isLoading = true
    const w = await render()
    expect(w.text()).toContain('Загрузка заработка')
    expect(w.find('[data-testid="earnings-monetization"]').exists()).toBe(true)
  })
})
