// Переход в профиль собеседника из чата: шапка и аватар в переписке ведут на
// страницу профиля. Полноэкранный чат при этом закрывается (иначе профиль
// откроется под ним), окошко на компьютере — нет.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ store: null as unknown as Record<string, unknown> }))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))

import ChatPartnerTitle from '../chat-partner-title/chat-partner-title.vue'
import type { ShownPartner } from '../chat-partner-title/use-shown-partner'

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const Page = { template: '<div />' }

let router: Router
let mounted: VueWrapper | null = null

async function render(partner: Partial<ShownPartner> = {}): Promise<VueWrapper> {
  mounted = mount(ChatPartnerTitle, {
    props: {
      partner: { name: 'Алиса', verified: false, address: ALICE, chatId: '!a:host', ...partner },
    },
    global: { plugins: [i18n, router], provide: { theme: {} } },
    attachTo: document.body,
  })
  await router.isReady()
  return mounted
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Page },
      { path: '/:userName', name: 'profile', component: Page },
    ],
  })
  await router.push('/')
  mocks.store = reactive({
    isFullScreen: false,
    closeFullScreen: vi.fn(() => (mocks.store.isFullScreen = false)),
  })
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('шапка чата ведёт в профиль собеседника', () => {
  it('аватар и имя — одна ссылка на профиль по адресу', async () => {
    const w = await render()
    const link = w.get('a')
    expect(link.attributes('href')).toBe(`/${ALICE}`)
    expect(link.attributes('aria-label')).toBe('Открыть профиль: Алиса')
    expect(link.text()).toContain('Алиса')
    expect(link.find('.bastyon-avatar, img').exists()).toBe(true)
  })

  it('окошко на компьютере: профиль открывается под ним, чат остаётся', async () => {
    const w = await render()
    await w.get('a').trigger('click', { button: 0 })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(`/${ALICE}`)
    expect(mocks.store.closeFullScreen).not.toHaveBeenCalled()
  })

  it('полноэкранный чат закрывается — даже если этот профиль уже открыт под ним', async () => {
    await router.push(`/${ALICE}`)
    mocks.store.isFullScreen = true
    const w = await render()
    await w.get('a').trigger('click', { button: 0 })
    expect(mocks.store.closeFullScreen).toHaveBeenCalledTimes(1)
  })

  it('открыть в новой вкладке — чат не трогаем', async () => {
    mocks.store.isFullScreen = true
    const w = await render()
    await w.get('a').trigger('click', { button: 0, ctrlKey: true })
    expect(mocks.store.closeFullScreen).not.toHaveBeenCalled()
  })

  it('у группы и чужого Matrix-аккаунта ссылки нет, а шапка та же', async () => {
    for (const address of [null, 'alice']) {
      const w = await render({ address, name: 'Книжный клуб' })
      expect(w.find('a').exists()).toBe(false)
      expect(w.text()).toContain('Книжный клуб')
      // Та же рамка, что у ссылки: адрес догрузится — шапка не сдвинется.
      expect(w.find('.chip').exists()).toBe(true)
      w.unmount()
    }
    mounted = null
  })
})
