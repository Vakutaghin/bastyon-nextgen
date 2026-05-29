/**
 * Меню профиля + signout/sign-in. Подписывается на `modalStore.authModal`,
 * чтобы открывать/закрывать sign-in / register модалки извне (например,
 * при попытке открыть mini-app без аккаунта).
 *
 * См. CODE_AUDIT.md §1.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import type { useAuthStore } from '@/blockchain'
import type { useModalStore } from '@/stores/modal-store'

type AuthStore = ReturnType<typeof useAuthStore>
type ModalStore = ReturnType<typeof useModalStore>

export interface AccountMenu {
  signInModalOpen: Ref<boolean>
  accountSwitcherOpen: Ref<boolean>
  confirmSignOutOpen: Ref<boolean>
  menuItems: ComputedRef<Array<{ key?: string; label?: string; type?: string; danger?: boolean }>>
  openSignInModal: () => void
  handleSignInSuccess: () => void
  handleSignInCancel: () => void
  handleOpenSignIn: () => void
  handleOpenRegister: () => void
  handleMenuClick: (event: { key: string }) => Promise<void>
  handleAccountSwitcherClose: () => void
  handleConfirmSignOut: () => void
  handleCancelSignOut: () => void
}

export interface AccountMenuOptions {
  authStore: AuthStore
  modalStore: ModalStore
  router: Router
  /** Открыть register-модалку (нужен флоу регистрации, который держится в use-registration-flow). */
  openRegister: () => void
  registerModalOpenRef: Ref<boolean>
}

export function useAccountMenu(opts: AccountMenuOptions): AccountMenu {
  const { authStore, modalStore, router, openRegister, registerModalOpenRef } = opts

  const signInModalOpen = ref(false)
  const accountSwitcherOpen = ref(false)
  const confirmSignOutOpen = ref(false)

  const userAddress = computed(() => authStore.getUserAddress)
  const userProfile = computed(() => authStore.getUserProfile)
  const isAuthenticated = computed(() => authStore.isUserAuthenticated)

  const profileLink = computed<string>(() => {
    if (userProfile.value?.name) return '/' + userProfile.value.name.toLowerCase()
    if (userAddress.value) return '/' + userAddress.value
    return '/'
  })

  const menuItems = computed(() => [
    { key: profileLink.value, label: 'Профиль' },
    { key: '/wallets', label: 'Кошельки' },
    { key: '/limits', label: 'Лимиты' },
    { key: '/my-videos', label: 'Мои видео' },
    { key: 'settings', label: 'Настройки' },
    { type: 'divider' },
    { key: 'switchAccount', label: 'Сменить аккаунт' },
    { key: 'signout', label: 'Выйти', danger: true },
  ])

  function openSignInModal(): void {
    signInModalOpen.value = true
  }

  function handleSignInSuccess(): void {
    signInModalOpen.value = false
    // Данные пользователя загружаются автоматически в auth-store после успешного входа.
  }

  function handleSignInCancel(): void {
    signInModalOpen.value = false
  }

  function handleOpenSignIn(): void {
    signInModalOpen.value = true
    registerModalOpenRef.value = false
  }

  function handleOpenRegister(): void {
    openRegister()
    signInModalOpen.value = false
  }

  async function handleMenuClick({ key }: { key: string }): Promise<void> {
    if (key === 'signout') {
      confirmSignOutOpen.value = true
    } else if (key === 'settings') {
      router.push('/settings')
    } else if (key === 'switchAccount') {
      accountSwitcherOpen.value = true
    } else if (key.startsWith('/')) {
      router.push(key)
    }
  }

  function handleAccountSwitcherClose(): void {
    accountSwitcherOpen.value = false
  }

  async function handleSignOut(): Promise<void> {
    try {
      // Выходим только из текущего аккаунта, а не из всех.
      const currentAddress = authStore.getUserAddress
      if (currentAddress) {
        await authStore.removeAccount(currentAddress)
      } else {
        // Если адреса нет — обычный signOut.
        await authStore.signOut()
      }
    } catch {
      // Игнорируем ошибки при выходе.
    }
    router.push('/')
  }

  function handleConfirmSignOut(): void {
    confirmSignOutOpen.value = false
    handleSignOut()
  }

  function handleCancelSignOut(): void {
    confirmSignOutOpen.value = false
  }

  // Синхронизация состояния модалок авторизации с глобальным store.
  watch(
    () => modalStore.authModal.isOpen,
    (isOpen) => {
      if (isOpen) {
        if (modalStore.authModal.mode === 'login') {
          signInModalOpen.value = true
          registerModalOpenRef.value = false
        } else {
          registerModalOpenRef.value = true
          signInModalOpen.value = false
        }
      } else {
        signInModalOpen.value = false
        registerModalOpenRef.value = false
      }
    }
  )

  // Если пользователь закрыл модалку вручную — закрываем и в store.
  watch(signInModalOpen, (isOpen) => {
    if (!isOpen && modalStore.authModal.isOpen && modalStore.authModal.mode === 'login') {
      modalStore.closeAuthModal()
    }
  })

  watch(registerModalOpenRef, (isOpen) => {
    if (!isOpen && modalStore.authModal.isOpen && modalStore.authModal.mode === 'register') {
      modalStore.closeAuthModal()
    }
  })

  // При смене адреса загружаем полное состояние пользователя.
  watch(userAddress, async (newAddress, oldAddress) => {
    if (newAddress && newAddress !== oldAddress && isAuthenticated.value) {
      // Очистка профиля выполняется в `switchAccount`, но на всякий случай
      // проверяем здесь, чтобы не показывать данные предыдущего аккаунта.
      const profile = authStore.getUserProfile
      if (profile) {
        const profileAddress = (profile as { address?: string })?.address
        if (profileAddress && profileAddress !== newAddress) {
          await authStore.fetchUserState()
        } else if (!profileAddress) {
          await authStore.fetchUserState()
        }
      } else {
        await authStore.fetchUserState()
      }
    }
  })

  return {
    signInModalOpen,
    accountSwitcherOpen,
    confirmSignOutOpen,
    menuItems,
    openSignInModal,
    handleSignInSuccess,
    handleSignInCancel,
    handleOpenSignIn,
    handleOpenRegister,
    handleMenuClick,
    handleAccountSwitcherClose,
    handleConfirmSignOut,
    handleCancelSignOut,
  }
}
