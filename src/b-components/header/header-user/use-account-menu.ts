/**
 * Меню профиля + signout/sign-in. Подписывается на `modalStore.authModal`,
 * чтобы открывать/закрывать sign-in / register модалки извне (например,
 * при попытке открыть mini-app без аккаунта).
 *
 * См. CODE_AUDIT.md §1.
 */
import {
  computed,
  h,
  ref,
  watch,
  type Component,
  type ComputedRef,
  type Ref,
  type VNode,
} from 'vue'
import type { Router } from 'vue-router'
import type { useAuthStore } from '@/blockchain'
import type { useModalStore } from '@/stores/modal-store'
import { t } from '@/i18n'
import { LogoutOutlined, SwapOutlined, UserAddOutlined } from '@/components/icons'
import type { MenuItemId } from '@/stores/header-layout'
import {
  MENU_ITEMS,
  MENU_ITEM_PATHS,
  defaultMenuItems,
} from '@/b-components/header/header-layout/layout-items'

type AuthStore = ReturnType<typeof useAuthStore>
type ModalStore = ReturnType<typeof useModalStore>

export interface AccountMenu {
  signInModalOpen: Ref<boolean>
  accountSwitcherOpen: Ref<boolean>
  confirmSignOutOpen: Ref<boolean>
  menuItems: ComputedRef<
    Array<{ key?: string; label?: string; type?: string; danger?: boolean; icon?: () => VNode }>
  >
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
  /** Незавершённая регистрация текущего аккаунта — пункт «Завершить регистрацию». */
  registrationUnfinished?: Ref<boolean>
  /**
   * Пункты по порядку — из Настройки → «Шапка и меню» (только те, что есть
   * на этой платформе). Без них — меню по умолчанию.
   */
  items?: Ref<MenuItemId[]>
}

export function useAccountMenu(opts: AccountMenuOptions): AccountMenu {
  const { authStore, modalStore, router, openRegister, registerModalOpenRef } = opts
  const registrationUnfinished = opts.registrationUnfinished ?? ref(false)

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

  const items = opts.items ?? computed(() => defaultMenuItems())

  /** Ключ пункта: путь раздела, у профиля — его ссылка, у действия — его id. */
  function keyOf(id: MenuItemId): string {
    if (id === 'profile') return profileLink.value
    return MENU_ITEM_PATHS[id] ?? id
  }

  /** Значок слева от подписи — тот же, что у пункта в «Шапке и меню» и в меню телефона. */
  const iconOf = (icon: Component) => () => h(icon)

  // Середина — из раскладки; «Завершить регистрацию» сверху и «Сменить
  // аккаунт» / «Выйти» снизу не настраиваются.
  const menuItems = computed(() => [
    ...(registrationUnfinished.value
      ? [
          {
            key: 'finishRegistration',
            label: t('accountMsg.menuFinishRegistration'),
            icon: iconOf(UserAddOutlined),
          },
          { type: 'divider' },
        ]
      : []),
    ...items.value.map((id) => ({
      key: keyOf(id),
      label: t(MENU_ITEMS[id].labelKey!),
      icon: iconOf(MENU_ITEMS[id].icon),
    })),
    { type: 'divider' },
    { key: 'switchAccount', label: t('accountMsg.menuSwitchAccount'), icon: iconOf(SwapOutlined) },
    {
      key: 'signout',
      label: t('accountMsg.menuSignOut'),
      danger: true,
      icon: iconOf(LogoutOutlined),
    },
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
    } else if (key === 'finishRegistration') {
      openRegister()
    } else if (key === 'reportBug') {
      // Чат поддержки — модуль мессенджера: грузится по нажатию.
      const { openSupportChat } = await import('../header-report-bug/open-support-chat')
      await openSupportChat()
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
  function syncAuthModal(isOpen: boolean): void {
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
  watch(() => modalStore.authModal.isOpen, syncAuthModal)
  // Окно могли попросить ещё до появления шапки: гостя, открывшего по ссылке
  // раздел для аккаунта, роутер просит войти при запуске.
  if (modalStore.authModal.isOpen) syncAuthModal(true)

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
