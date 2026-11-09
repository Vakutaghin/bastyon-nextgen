// Карточка ссылки на профиль или коллекцию в сообщении: ник и репутация из
// кэша профилей (нет — догружаем), коллекция — название, тип, сколько внутри
// и автор; нажатие ведёт туда и закрывает полноэкранный чат.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  fetchCollection: vi.fn(),
}))

vi.mock('../../store', () => ({ useMessengerStore: () => mocks.store }))
vi.mock('@/services/collections/collections-api', () => ({
  fetchCollection: mocks.fetchCollection,
}))
vi.mock('@/services/user-names', () => ({ userName: (address: string) => `nick-of-${address}` }))

import EntityEmbed from './entity-embed.vue'
import type { EntityLinkTarget } from '../../lib/entity-link'
import { resetCollectionCardsForTests } from './load-collection'

const ADDRESS = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const TX = 'b'.repeat(64)

let wrapper: VueWrapper | null = null

function render(target: EntityLinkTarget) {
  const page = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page },
      { path: '/collection/:txid', component: page },
      { path: '/:userName', name: 'profile', component: page },
    ],
  })
  wrapper = mount(EntityEmbed, {
    props: { target },
    attachTo: document.body,
    global: { plugins: [i18n, router], provide: { theme: {} } },
  })
  return { router }
}

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => {
  resetCollectionCardsForTests()
  mocks.fetchCollection.mockReset()
  mocks.store = reactive({
    userProfiles: {} as Record<string, unknown>,
    fetchProfiles: vi.fn(async () => {}),
    isFullScreen: true,
    closeFullScreen: vi.fn(),
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('карточка профиля', () => {
  it('ник и репутация из кэша; нажатие — в профиль, полноэкранный чат закрывается', async () => {
    ;(mocks.store.userProfiles as Record<string, unknown>)[ADDRESS] = {
      address: ADDRESS,
      name: 'alice_ng',
      reputation: 5000,
    }
    const { router } = render({ kind: 'profile', address: ADDRESS })
    const card = wrapper!.get('[data-testid="profile-embed"]')
    expect(card.text()).toContain('alice_ng')
    expect(card.text()).toMatch(/Репутация 5\s?000/)
    expect(mocks.store.fetchProfiles).not.toHaveBeenCalled()

    await wrapper!.find('a').trigger('click', { button: 0 })
    await flushPromises()
    expect(mocks.store.closeFullScreen).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe(`/${ADDRESS}`)
  })

  it('профиля в кэше нет — догружаем, а пока — ник из справочника и «Профиль в Бастионе»', () => {
    render({ kind: 'profile', address: ADDRESS })
    expect(mocks.store.fetchProfiles).toHaveBeenCalledWith([ADDRESS])
    expect(wrapper!.text()).toContain(`nick-of-${ADDRESS}`)
    expect(wrapper!.text()).toContain('Профиль в Бастионе')
  })
})

describe('карточка коллекции', () => {
  it('название, тип, сколько внутри и автор; нажатие — на страницу коллекции', async () => {
    mocks.fetchCollection.mockResolvedValue({
      txid: TX,
      address: ADDRESS,
      caption: 'Лучшее за год',
      contentTypes: 201,
      contentIds: ['1', '2', '3'],
      image: '',
    })
    const { router } = render({ kind: 'collection', txid: TX })
    await flushPromises()
    const card = wrapper!.get('[data-testid="collection-embed"]')
    expect(card.text()).toContain('Лучшее за год')
    expect(card.text()).toContain(`3 видео · nick-of-${ADDRESS}`)

    await card.trigger('click', { button: 0 })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/collection/${TX}`)
    expect(mocks.store.closeFullScreen).toHaveBeenCalled()
  })

  it('не загрузилась — всё равно карточка со ссылкой на страницу коллекции', async () => {
    mocks.fetchCollection.mockResolvedValue(null)
    render({ kind: 'collection', txid: TX })
    await flushPromises()
    expect(wrapper!.text()).toContain('Коллекция в Бастионе')
    expect(wrapper!.get('[data-testid="collection-embed"]').attributes('href')).toBe(
      `/collection/${TX}`
    )
  })
})
