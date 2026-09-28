// Меню аккаунта в шапке: набор пунктов (незавершённая регистрация, «Мои
// файлы» только на десктопе), переходы, выход только из текущего аккаунта
// после подтверждения и синхронизация окон входа/регистрации с modalStore.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

const mocks = vi.hoisted(() => ({ tauri: false }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/helpers/api/request-tor', () => ({ isTauriEnv: () => mocks.tauri }))

import { useAccountMenu, type AccountMenuOptions } from './use-account-menu'

function setup(overrides: { registrationUnfinished?: boolean } = {}) {
  const authStore = reactive({
    getUserAddress: 'PAddr1' as string | null,
    getUserProfile: null as { name?: string; address?: string } | null,
    isUserAuthenticated: true,
    removeAccount: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    fetchUserState: vi.fn(async () => {}),
  })
  const modalStore = reactive({
    authModal: { isOpen: false, mode: 'login' as 'login' | 'register' },
    closeAuthModal: vi.fn(() => {
      modalStore.authModal.isOpen = false
    }),
  })
  const router = { push: vi.fn() }
  const openRegister = vi.fn()
  const registerModalOpenRef = ref(false)
  const registrationUnfinished = ref(overrides.registrationUnfinished ?? false)
  const menu = useAccountMenu({
    authStore,
    modalStore,
    router,
    openRegister,
    registerModalOpenRef,
    registrationUnfinished,
  } as unknown as AccountMenuOptions)
  return {
    authStore,
    modalStore,
    router,
    openRegister,
    registerModalOpenRef,
    registrationUnfinished,
    menu,
  }
}

const keys = (items: Array<{ key?: string; type?: string }>) => items.map((i) => i.key ?? i.type)

describe('useAccountMenu', () => {
  beforeEach(() => {
    mocks.tauri = false
  })

  it('пункты меню в вебе: профиль по адресу, без «Моих файлов»', () => {
    const { menu } = setup()
    expect(keys(menu.menuItems.value)).toEqual([
      '/PAddr1',
      '/wallets',
      '/limits',
      '/my-videos',
      '/help',
      'settings',
      'divider',
      'switchAccount',
      'signout',
    ])
    const items = menu.menuItems.value
    expect(items[items.length - 1]).toMatchObject({ key: 'signout', danger: true })
  })

  it('на десктопе есть «Мои файлы»; незавершённая регистрация — первым пунктом', () => {
    mocks.tauri = true
    const { menu, registrationUnfinished } = setup()
    expect(keys(menu.menuItems.value)).toContain('/my-files')

    registrationUnfinished.value = true
    expect(keys(menu.menuItems.value).slice(0, 2)).toEqual(['finishRegistration', 'divider'])
  })

  it('ссылка на профиль — по имени в нижнем регистре, иначе по адресу, иначе на главную', () => {
    const { menu, authStore } = setup()
    authStore.getUserProfile = { name: 'AliceBob' }
    expect(menu.menuItems.value[0]?.key).toBe('/alicebob')
    authStore.getUserProfile = null
    authStore.getUserAddress = null
    expect(menu.menuItems.value[0]?.key).toBe('/')
  })

  it('клики по пунктам: переходы, регистрация, свитчер', async () => {
    const { menu, router, openRegister } = setup({ registrationUnfinished: true })
    await menu.handleMenuClick({ key: '/wallets' })
    await menu.handleMenuClick({ key: 'settings' })
    expect(router.push.mock.calls).toEqual([['/wallets'], ['/settings']])

    await menu.handleMenuClick({ key: 'finishRegistration' })
    expect(openRegister).toHaveBeenCalledTimes(1)

    await menu.handleMenuClick({ key: 'switchAccount' })
    expect(menu.accountSwitcherOpen.value).toBe(true)
    menu.handleAccountSwitcherClose()
    expect(menu.accountSwitcherOpen.value).toBe(false)

    await menu.handleMenuClick({ key: 'unknown' })
    expect(router.push).toHaveBeenCalledTimes(2)
  })

  it('«Выйти» сначала спрашивает; «Отмена» ничего не трогает', async () => {
    const { menu, authStore, router } = setup()
    await menu.handleMenuClick({ key: 'signout' })
    expect(menu.confirmSignOutOpen.value).toBe(true)
    expect(authStore.removeAccount).not.toHaveBeenCalled()

    menu.handleCancelSignOut()
    expect(menu.confirmSignOutOpen.value).toBe(false)
    expect(authStore.removeAccount).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('подтверждённый выход убирает только текущий аккаунт и ведёт на главную', async () => {
    const { menu, authStore, router } = setup()
    menu.handleConfirmSignOut()
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
    expect(authStore.removeAccount).toHaveBeenCalledWith('PAddr1')
    expect(authStore.signOut).not.toHaveBeenCalled()
    expect(menu.confirmSignOutOpen.value).toBe(false)
  })

  it('без адреса — обычный signOut; ошибка выхода не мешает уйти на главную', async () => {
    const { menu, authStore, router } = setup()
    authStore.getUserAddress = null
    authStore.signOut.mockRejectedValueOnce(new Error('storage'))
    menu.handleConfirmSignOut()
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
    expect(authStore.signOut).toHaveBeenCalledTimes(1)
  })

  it('окна входа и регистрации открываются и закрываются вместе с modalStore', async () => {
    const { menu, modalStore, registerModalOpenRef } = setup()

    modalStore.authModal = { isOpen: true, mode: 'login' }
    await nextTick()
    expect(menu.signInModalOpen.value).toBe(true)
    expect(registerModalOpenRef.value).toBe(false)

    modalStore.authModal = { isOpen: false, mode: 'login' }
    await nextTick()
    expect(menu.signInModalOpen.value).toBe(false)

    modalStore.authModal = { isOpen: true, mode: 'register' }
    await nextTick()
    expect(registerModalOpenRef.value).toBe(true)
    expect(menu.signInModalOpen.value).toBe(false)
  })

  it('закрытое вручную окно закрывает и глобальное — только своего режима', async () => {
    const { menu, modalStore, registerModalOpenRef } = setup()

    modalStore.authModal = { isOpen: true, mode: 'login' }
    await nextTick()
    menu.handleSignInCancel()
    await nextTick()
    expect(modalStore.closeAuthModal).toHaveBeenCalledTimes(1)

    modalStore.authModal = { isOpen: true, mode: 'register' }
    await nextTick()
    registerModalOpenRef.value = false
    await nextTick()
    expect(modalStore.closeAuthModal).toHaveBeenCalledTimes(2)
  })

  it('переключение между входом и регистрацией', () => {
    const { menu, openRegister, registerModalOpenRef } = setup()
    registerModalOpenRef.value = true
    menu.handleOpenSignIn()
    expect(menu.signInModalOpen.value).toBe(true)
    expect(registerModalOpenRef.value).toBe(false)

    menu.handleOpenRegister()
    expect(openRegister).toHaveBeenCalledTimes(1)
    expect(menu.signInModalOpen.value).toBe(false)

    menu.openSignInModal()
    menu.handleSignInSuccess()
    expect(menu.signInModalOpen.value).toBe(false)
  })

  it('смена адреса подгружает состояние, если профиль чужой или его нет', async () => {
    const { authStore } = setup()

    authStore.getUserProfile = { address: 'PAddr1', name: 'a' }
    authStore.getUserAddress = 'PAddr2'
    await nextTick()
    await vi.waitFor(() => expect(authStore.fetchUserState).toHaveBeenCalledTimes(1))

    authStore.getUserProfile = null
    authStore.getUserAddress = 'PAddr3'
    await nextTick()
    await vi.waitFor(() => expect(authStore.fetchUserState).toHaveBeenCalledTimes(2))
  })

  it('профиль уже от нового адреса или пользователь не вошёл — лишней загрузки нет', async () => {
    const { authStore } = setup()

    authStore.getUserProfile = { address: 'PAddr2' }
    authStore.getUserAddress = 'PAddr2'
    await nextTick()

    authStore.isUserAuthenticated = false
    authStore.getUserAddress = 'PAddr3'
    await nextTick()

    expect(authStore.fetchUserState).not.toHaveBeenCalled()
  })
})
