// «Монетизация для авторов»: схема из четырёх шагов по кругу, путь в статью
// справки, почта команды (открыть и скопировать), история кошелька — только
// вошедшим, «Где купить и продать PKOIN» — статья сбоку.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  auth: { isUserAuthenticated: false },
  openTopic: vi.fn(),
  openExternal: vi.fn(async () => true),
  copyText: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores/help-store', () => ({ useHelpStore: () => ({ openTopic: mocks.openTopic }) }))
vi.mock('@/helpers/common/open-external', () => ({ openExternal: mocks.openExternal }))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copyText }))
vi.mock('@/b-components/app-toast', () => ({ appToast: mocks.toast }))

import MonetizationPage from './monetization-page.vue'

const Page = { template: '<div />' }
let router: Router
let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  wrapper = mount(MonetizationPage, { global: { plugins: [i18n, router] } })
  await router.isReady()
  return wrapper
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(async () => {
  mocks.auth = reactive({ isUserAuthenticated: false })
  vi.clearAllMocks()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/monetization', name: 'monetization', component: Page },
      { path: '/wallets', name: 'wallets', component: Page },
    ],
  })
  await router.push('/monetization')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('страница «Монетизация»', () => {
  it('схема: четыре шага по порядку и замыкание круга через биржу', async () => {
    const w = await render()
    const steps = w.findAll('ol > li')
    expect(steps.map((s) => s.text())).toEqual([
      expect.stringContaining('Рекламодатель'),
      expect.stringContaining('Реклама'),
      expect.stringContaining('Читатели'),
      expect.stringContaining('Выплата'),
    ])
    expect(steps[0]!.text()).toContain('1')
    expect(w.text()).toContain('снова попадают к рекламодателям')
  })

  it('«Подробнее в справке» открывает статью monetization сбоку', async () => {
    const w = await render()
    await w.get('[data-testid="monetization-help"]').trigger('click')
    expect(mocks.openTopic).toHaveBeenCalledWith('monetization')
  })

  it('«Где купить и продать PKOIN» — статья про биржи', async () => {
    const w = await render()
    const link = w.findAll('[data-help-link]').find((b) => b.text().includes('купить и продать'))
    await link!.trigger('click')
    expect(mocks.openTopic).toHaveBeenCalledWith('how-to-buy-pkoin')
  })

  it('почта команды открывается письмом и копируется', async () => {
    const w = await render()
    await w.get('[data-testid="monetization-mail"]').trigger('click')
    expect(mocks.openExternal).toHaveBeenCalledWith('mailto:support@bastyon.com')

    await w.get('[data-testid="monetization-copy-email"]').trigger('click')
    await flushPromises()
    expect(mocks.copyText).toHaveBeenCalledWith('support@bastyon.com')
    expect(mocks.toast.success).toHaveBeenCalledWith({ message: 'Адрес скопирован' })
  })

  it('гостю нет ссылки на кошелёк, вошедшему — история операций', async () => {
    let w = await render()
    expect(w.find('[data-testid="monetization-history"]').exists()).toBe(false)
    w.unmount()

    mocks.auth.isUserAuthenticated = true
    w = await render()
    const link = w.get('[data-testid="monetization-history"]')
    expect(link.attributes('href')).toBe('/wallets?tab=history')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallets?tab=history')
  })
})
