// Смена страницы для диктора: после перехода на другой адрес произносится
// название новой страницы; запуск и смена query (вкладка ленты) — молча.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setDocumentTitle } from './use-document-title'
import { ROUTE_ANNOUNCE_DELAY_MS, watchRouteAnnouncements } from './use-route-announcer'

const page = { render: () => null }

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page, meta: { title: 'Лента' } },
      { path: '/settings', component: page, meta: { title: 'Настройки' } },
    ],
  })
  router.afterEach((to) => setDocumentTitle(to.meta.title as string))
  return router
}

const spoken = () => document.getElementById('a11y-live-polite')?.textContent ?? ''

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('watchRouteAnnouncements', () => {
  it('переход на другую страницу — её название, без числа непрочитанных и имени приложения', async () => {
    vi.useFakeTimers()
    const router = makeRouter()
    const stop = watchRouteAnnouncements(router)
    await router.push('/')
    vi.advanceTimersByTime(ROUTE_ANNOUNCE_DELAY_MS + 100)
    expect(spoken()).toBe('')

    await router.push('/settings')
    vi.advanceTimersByTime(ROUTE_ANNOUNCE_DELAY_MS + 100)
    expect(spoken()).toBe('Настройки')
    stop()
  })

  it('тот же путь с другим query — не объявляется', async () => {
    vi.useFakeTimers()
    const router = makeRouter()
    const stop = watchRouteAnnouncements(router)
    await router.push('/')
    await router.push('/?feedMode=video')
    vi.advanceTimersByTime(ROUTE_ANNOUNCE_DELAY_MS + 100)
    expect(spoken()).toBe('')
    stop()
  })
})
