// Роутер: служебные пути (/explorer, /search, /help, /post…) не проглатываются
// профилем /:userName, старые /info/* ведут в справку, страницы аккаунта
// пускают только после restoreSession с вошедшим пользователем (гостя просят
// войти, не уводя со страницы), а заголовок вкладки следует за маршрутом и за
// сменой языка.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useModalStore } from '@/stores/modal-store'

const mocks = vi.hoisted(() => ({
  auth: {
    isUserAuthenticated: false,
    restoreSession: vi.fn(async () => {}),
  },
  setDocumentTitle: vi.fn(),
  locale: { value: 'ru' },
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/use-document-title', () => ({
  setDocumentTitle: mocks.setDocumentTitle,
}))
vi.mock('@/i18n', async () => {
  const { ref: vueRef } = await import('vue')
  const locale = vueRef('ru')
  mocks.locale = locale
  return { i18n: { global: { locale } }, t: (key: string) => `t:${key}` }
})

// Страницы грузятся лениво; настоящие тянут за собой всё приложение.
const page = { default: { render: () => null } }
vi.mock('@/pages/home-page/home-page.vue', () => page)
vi.mock('@/pages/profile-page/profile-page.vue', () => page)
vi.mock('@/pages/settings-page/settings-page.vue', () => page)
vi.mock('@/pages/limits-page/limits-page.vue', () => page)
vi.mock('@/pages/wallets-page/wallets-page.vue', () => page)
vi.mock('@/pages/my-videos-page/my-videos-page.vue', () => page)
vi.mock('@/pages/my-files-page/my-files-page.vue', () => page)
vi.mock('@/pages/block-explorer-page/block-explorer-page.vue', () => page)
vi.mock('@/pages/block-explorer-page/block-page/block-page.vue', () => page)
vi.mock('@/pages/block-explorer-page/tx-page/tx-page.vue', () => page)
vi.mock('@/pages/block-explorer-page/address-page/address-page.vue', () => page)
vi.mock('@/pages/block-explorer-page/peers-page/peers-page.vue', () => page)
vi.mock('@/pages/search-page/search-page.vue', () => page)
vi.mock('@/pages/mini-apps-page/mini-apps-page.vue', () => page)
vi.mock('@/pages/mini-app-page/mini-app-page.vue', () => page)
vi.mock('@/pages/post-page/post-page.vue', () => page)
vi.mock('@/pages/compose-page/compose-page.vue', () => page)
vi.mock('@/pages/help-page/help-page.vue', () => page)
vi.mock('@/pages/embed-post-page/embed-post-page.vue', () => page)

import router from './index'

describe('router: сопоставление путей', () => {
  it.each([
    ['/', 'home'],
    ['/explorer', 'explorer'],
    ['/explorer/block/3000000', 'explorer-block'],
    ['/explorer/tx/abc123', 'explorer-tx'],
    ['/explorer/address/PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM', 'explorer-address'],
    ['/explorer/peers', 'explorer-peers'],
    ['/search', 'search'],
    ['/miniapps', 'miniapps'],
    ['/post/abc123', 'post'],
    ['/compose', 'compose'],
    ['/help', 'help'],
    ['/help/faq', 'help'],
    ['/embed/post/abc123', 'embed-post'],
    ['/someuser', 'profile'],
    ['/PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM', 'profile'],
  ])('%s → %s', (path, name) => {
    expect(router.resolve(path).name).toBe(name)
  })

  it('параметры: блок, мини-приложение с вложенным путём, тема справки', () => {
    expect(router.resolve('/explorer/block/42').params).toEqual({ hashOrHeight: '42' })
    expect(router.resolve('/app/chess/room/7').params).toEqual({
      appId: 'chess',
      innerPath: 'room/7',
    })
    expect(router.resolve('/app/chess').name).toBe('mini-app')
    expect(router.resolve('/help/how-to-buy-pkoin').params).toEqual({ topic: 'how-to-buy-pkoin' })
  })

  it('встраиваемый пост помечен как embed, кошелёк знает свою статью справки', () => {
    expect(router.resolve('/embed/post/x').meta.embed).toBe(true)
    expect(router.resolve('/wallets').meta.helpTopic).toBe('wallet')
  })

  it.each([
    ['/info/about', '/help/about'],
    ['/info/faq', '/help/faq'],
    ['/info/help', '/help/getting-started'],
    ['/info/howtobuy', '/help/how-to-buy-pkoin'],
  ])('старый адрес %s ведёт в справку %s', async (from, to) => {
    await router.push(from)
    expect(router.currentRoute.value.path).toBe(to)
  })
})

describe('router: страницы аккаунта', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mocks.auth.isUserAuthenticated = false
    mocks.auth.restoreSession.mockReset().mockResolvedValue(undefined)
    await router.push('/')
    mocks.setDocumentTitle.mockReset()
  })

  it.each(['/wallets', '/settings', '/limits', '/my-videos', '/my-files'])(
    'гость, открывший %s, остаётся на месте и видит окно входа',
    async (path) => {
      await router.push('/help')
      await router.push(path)
      expect(mocks.auth.restoreSession).toHaveBeenCalledTimes(1)
      expect(router.currentRoute.value.name).toBe('help')
      expect(useModalStore().authModal).toMatchObject({ isOpen: true, mode: 'login' })
    }
  )

  it('сохранённая сессия поднимается до проверки — вошедший проходит', async () => {
    mocks.auth.restoreSession.mockImplementation(async () => {
      mocks.auth.isUserAuthenticated = true
    })
    await router.push('/wallets')
    expect(router.currentRoute.value.name).toBe('wallets')
  })

  it.each(['/help/faq', '/explorer', '/search', '/someuser', '/post/abc'])(
    '%s открывается без входа и без restoreSession',
    async (path) => {
      await router.push(path)
      expect(router.currentRoute.value.path).toBe(path)
      expect(mocks.auth.restoreSession).not.toHaveBeenCalled()
    }
  )

  it('заголовок вкладки — по маршруту и заново при смене языка', async () => {
    await router.push('/explorer')
    expect(mocks.setDocumentTitle).toHaveBeenLastCalledWith('t:routes.explorer')

    mocks.setDocumentTitle.mockReset()
    mocks.locale.value = 'en'
    await nextTick()
    expect(mocks.setDocumentTitle).toHaveBeenCalledWith('t:routes.explorer')
  })
})
