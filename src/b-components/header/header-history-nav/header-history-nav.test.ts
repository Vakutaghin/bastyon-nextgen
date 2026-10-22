// Стрелки «Назад» и «Вперёд» в шапке ходят по истории приложения, как кнопки
// браузера, и выключены, когда идти некуда. На телефоне — только «Назад», и
// только когда есть куда вернуться.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRouter, createWebHistory, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

import HeaderHistoryNav from './header-history-nav.vue'

const Page = { template: '<div />' }

let router: Router
let mounted: VueWrapper | null = null

async function render(compact = false): Promise<VueWrapper> {
  mounted = mount(HeaderHistoryNav, {
    props: { compact },
    global: { plugins: [i18n, router], provide: { theme: {} } },
    attachTo: document.body,
  })
  await router.isReady()
  return mounted
}

/** history.back() отвечает popstate не сразу. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

const back = (w: VueWrapper) => w.find('[data-testid="history-back"]')
const forward = (w: VueWrapper) => w.find('[data-testid="history-forward"]')

beforeAll(() => setI18nLocale('ru'))

beforeEach(async () => {
  // Каждый тест — с чистой первой страницы: без `back` в history.state.
  window.history.replaceState(null, '', '/')
  router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: Page },
      { path: '/a', component: Page },
      { path: '/b', component: Page },
    ],
  })
  await router.push('/')
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('стрелки истории в шапке', () => {
  it('на первой странице обе стрелки выключены, нажатие ничего не делает', async () => {
    const w = await render()
    expect(back(w).attributes('aria-disabled')).toBe('true')
    expect(forward(w).attributes('aria-disabled')).toBe('true')
    expect(back(w).attributes('aria-label')).toBe('Назад')

    await back(w).trigger('click')
    await settle()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('назад и вперёд — по открытым страницам', async () => {
    const w = await render()
    await router.push('/a')
    await router.push('/b')
    await flushPromises()
    expect(back(w).attributes('aria-disabled')).toBe('false')
    expect(forward(w).attributes('aria-disabled')).toBe('true')

    await back(w).trigger('click')
    await settle()
    expect(router.currentRoute.value.path).toBe('/a')
    expect(forward(w).attributes('aria-disabled')).toBe('false')

    await back(w).trigger('click')
    await settle()
    expect(router.currentRoute.value.path).toBe('/')
    expect(back(w).attributes('aria-disabled')).toBe('true')

    await forward(w).trigger('click')
    await settle()
    expect(router.currentRoute.value.path).toBe('/a')
  })

  it('новая страница после шага назад обнуляет «Вперёд»', async () => {
    const w = await render()
    await router.push('/a')
    await back(w).trigger('click')
    await settle()
    expect(forward(w).attributes('aria-disabled')).toBe('false')

    await router.push('/b')
    await flushPromises()
    expect(forward(w).attributes('aria-disabled')).toBe('true')
  })

  it('на телефоне — только «Назад» и только когда есть куда', async () => {
    const w = await render(true)
    expect(back(w).exists()).toBe(false)

    await router.push('/a')
    await flushPromises()
    expect(back(w).exists()).toBe(true)
    expect(forward(w).exists()).toBe(false)

    await back(w).trigger('click')
    await settle()
    expect(router.currentRoute.value.path).toBe('/')
    expect(back(w).exists()).toBe(false)
  })
})
