// Сменили аккаунт — со страницы прежнего уходим на ленту, страница и лента
// собираются заново, окна поста и композера закрываются. Вход гостя и возврат
// к тому же аккаунту экран не трогают.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, type Ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { mount } from '@vue/test-utils'

const auth = vi.hoisted(() => ({
  state: null as null | {
    isUserAuthenticated: boolean
    getUserAddress: string | null
    accountEpoch: number
  },
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => auth.state }))

import { useModalStore } from '@/stores/modal-store'
import { useAccountSwitchReset } from './use-account-switch-reset'

const Page = defineComponent({ setup: () => () => h('div') })

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/my-videos', name: 'my-videos', component: Page },
      { path: '/post/:txid', name: 'post', component: Page },
    ],
  })
}

async function setup(path: string, address: string | null) {
  auth.state!.isUserAuthenticated = !!address
  auth.state!.getUserAddress = address
  const router = makeRouter()
  await router.push(path)
  let pageKey!: Ref<number>
  mount(
    defineComponent({
      setup() {
        pageKey = useAccountSwitchReset()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } }
  )
  return { router, pageKey: () => pageKey.value }
}

/** Как auth-store: адрес сменился, затем сторы сброшены (accountEpoch). */
async function becomes(address: string | null): Promise<void> {
  auth.state!.isUserAuthenticated = !!address
  auth.state!.getUserAddress = address
  await nextTick()
  auth.state!.accountEpoch++
  await nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

describe('useAccountSwitchReset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    auth.state = reactive({ isUserAuthenticated: false, getUserAddress: null, accountEpoch: 0 })
    window.scrollTo = vi.fn() as never
  })

  it('переключили аккаунт в «Моих видео» — на ленту, страница собирается заново', async () => {
    const { router, pageKey } = await setup('/my-videos', 'PFirst')
    const modals = useModalStore()
    modals.postComposerModal.isOpen = true

    await becomes('PSecond')

    expect(router.currentRoute.value.name).toBe('home')
    expect(pageKey()).toBe(1)
    expect(modals.postComposerModal.isOpen).toBe(false)
  })

  it('уже на ленте — лента собирается заново', async () => {
    const { router, pageKey } = await setup('/', 'PFirst')
    await becomes('PSecond')
    expect(router.currentRoute.value.name).toBe('home')
    expect(pageKey()).toBe(1)
  })

  it('выход — тоже уход со страницы прежнего аккаунта', async () => {
    const { router, pageKey } = await setup('/my-videos', 'PFirst')
    await becomes(null)
    expect(router.currentRoute.value.name).toBe('home')
    expect(pageKey()).toBe(1)
  })

  it('гость вошёл — остаётся, где был: входил, чтобы сделать что-то здесь', async () => {
    const { router, pageKey } = await setup('/post/abc', null)
    await becomes('PFirst')
    expect(router.currentRoute.value.fullPath).toBe('/post/abc')
    expect(pageKey()).toBe(0)

    // А дальше смена аккаунта уже уводит.
    await becomes('PSecond')
    expect(router.currentRoute.value.name).toBe('home')
    expect(pageKey()).toBe(1)
  })

  it('неудачное «Добавить аккаунт» вернуло тот же аккаунт — экран не трогаем', async () => {
    const { router, pageKey } = await setup('/my-videos', 'PFirst')
    auth.state!.isUserAuthenticated = false
    await nextTick()
    await becomes('PFirst')
    expect(router.currentRoute.value.name).toBe('my-videos')
    expect(pageKey()).toBe(0)
  })
})
