// Упоминание в пузыре: «@имя» ссылкой на профиль упомянутого; имя — из
// профиля, если он есть; упомянули вас — подсвечено. Полноэкранный чат при
// переходе закрывается, как у ссылки на профиль в шапке.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'
import { addressToHex } from '../../services/matrix-service/address-codec'

const mocks = vi.hoisted(() => ({ store: null as unknown as Record<string, unknown> }))
vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('../../services/matrix-service', async () => {
  const codec = await import('../../services/matrix-service/address-codec')
  return { matrixService: { hexToAddress: codec.hexToAddress } }
})

import MentionLink from './mention-link.vue'

const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const ME = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const Page = { template: '<div />' }

let router: Router
let mounted: VueWrapper | null = null

async function render(address: string, name: string): Promise<VueWrapper> {
  mounted = mount(MentionLink, {
    props: { address, name },
    global: { plugins: [i18n, router] },
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
    currentUser: { id: `@${addressToHex(ME)}:matrix.pocketnet.app` },
    userProfiles: {} as Record<string, { name?: string }>,
    isFullScreen: false,
    closeFullScreen: vi.fn(),
  })
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('MentionLink', () => {
  it('«@имя» ведёт в профиль; имя из профиля важнее присланного', async () => {
    const w = await render(BOB, 'bob_old')
    const a = w.get('[data-testid="mention"]')
    expect(a.text()).toBe('@bob_old')
    expect(a.attributes('href')).toBe(`/${BOB}`)
    expect(a.classes()).not.toContain('me')
    ;(mocks.store.userProfiles as Record<string, { name: string }>)[BOB] = { name: 'bob_ng' }
    await flushPromises()
    expect(a.text()).toBe('@bob_ng')
  })

  it('упомянули вас — подсвечено', async () => {
    const w = await render(ME, 'me')
    expect(w.get('[data-testid="mention"]').classes()).toContain('me')
  })

  it('из полноэкранного чата — в профиль, чат закрывается', async () => {
    mocks.store.isFullScreen = true
    const w = await render(BOB, 'bob_ng')
    await w.get('[data-testid="mention"]').trigger('click', { button: 0 })
    await flushPromises()
    expect(mocks.store.closeFullScreen).toHaveBeenCalled()
    expect(router.currentRoute.value.params.userName).toBe(BOB)
  })
})
