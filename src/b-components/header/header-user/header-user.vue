<template>
  <template v-if="isAuthRestoring">
    <SC_AuthSkeleton aria-hidden="true">
      <Skeleton :width="32" :height="32" :radius="16" />
      <SC_SkeletonLines>
        <Skeleton :width="90" :height="12" :radius="4" />
        <Skeleton :width="60" :height="10" :radius="4" />
      </SC_SkeletonLines>
    </SC_AuthSkeleton>
  </template>
  <template v-else-if="!isAuthenticated">
    <Button type="default" @click="openSignInModal"> Войти </Button>

    <Button type="default" @click="openRegisterModal"> Регистрация </Button>
  </template>
  <template v-else>
    <Dropdown
      :trigger="['click']"
      placement="bottomRight"
      :overlay-class-name="dropdownOverlayClass"
    >
      <SC_UserInfoTrigger>
        <Avatar
          :src="userAvatar"
          :alt="userInitial"
          :fallback-text="userName"
          :size="32"
          :verified="isUserVerified"
          :pending="registrationPending"
          data-header-avatar="true"
          @click.stop="onAvatarClick"
        />

        <SC_UserDetails>
          <SC_UserName>{{ userName }}</SC_UserName>

          <SC_UserBalance v-if="typeof userBalance === 'number'">
            {{ formatBalance(userBalance) }} PKOIN
          </SC_UserBalance>

          <SC_UserLoading v-else-if="authStore.isLoading || authStore.isFetchingUserState">
            Загрузка...
          </SC_UserLoading>
        </SC_UserDetails>
      </SC_UserInfoTrigger>

      <template #overlay>
        <Menu :items="menuItems" @click="handleMenuClick" />
      </template>
    </Dropdown>
  </template>
  <SC_HeaderDropdownZindexFix
    ref="dropdownZindexFixRef"
    style="position: absolute; left: -9999px; visibility: hidden; pointer-events: none"
    aria-hidden="true"
  />

  <SignInModal
    v-model:open="signInModalOpen"
    @success="handleSignInSuccess"
    @cancel="handleSignInCancel"
    @open-register="handleOpenRegister"
  />

  <RegisterModal
    v-model:open="registerModalOpen"
    @success="handleRegisterSuccess"
    @validation="handleRegisterValidation"
    @cancel="handleRegisterCancel"
    @open-sign-in="handleOpenSignIn"
  />

  <RegistrationValidationModal
    v-model:open="validationModalOpen"
    :status="validationStatus"
    @update:open="handleValidationModalUpdate"
  />

  <MnemonicModal
    v-model:open="mnemonicModalOpen"
    :mnemonic="mnemonic"
    :private-key-hex="privateKeyHex"
    @close="handleMnemonicModalClose"
  />

  <AccountSwitcher v-model:open="accountSwitcherOpen" @close="handleAccountSwitcherClose" />

  <ConfirmSignOutModal
    v-model:open="confirmSignOutOpen"
    @confirm="handleConfirmSignOut"
    @cancel="handleCancelSignOut"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dropdown, Menu } from 'ant-design-vue'
import { debugLog } from '@/helpers/common/debug-log'
import Button from '@/components/button/button.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import RegisterModal from '@/b-components/header/register-modal/register-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import AccountSwitcher from '@/b-components/header/account-switcher/account-switcher.vue'
import ConfirmSignOutModal from '@/b-components/header/confirm-sign-out-modal/confirm-sign-out-modal.vue'
import RegistrationValidationModal from '@/b-components/header/registration-validation-modal/registration-validation-modal.vue'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { extractAvatarFromProfile } from '@/helpers/common/profile-avatar'
import { shouldShowMnemonic } from '@/helpers/common/mnemonic-storage'
import { retryRegistrationBackgroundTx } from './helpers/retry-registration-tx'
import { loadPendingMnemonic } from './helpers/pending-mnemonic'
import {
  createRegistrationStatusWatcher,
  type RegistrationStatusWatcher,
} from './helpers/registration-status-watcher'
import {
  SC_UserDetails,
  SC_UserName,
  SC_UserBalance,
  SC_UserLoading,
  SC_UserInfoTrigger,
  SC_HeaderDropdownZindexFix,
  SC_AuthSkeleton,
  SC_SkeletonLines,
} from './styled'

const authStore = useAuthStore()
const modalStore = useModalStore()
const router = useRouter()

const signInModalOpen = ref(false)
const registerModalOpen = ref(false)
const mnemonicModalOpen = ref(false)
const mnemonic = ref('')
const privateKeyHex = ref('')
const accountSwitcherOpen = ref(false)
const confirmSignOutOpen = ref(false)
const validationModalOpen = ref(false)
const validationStatus = ref<string | null>(null)
const registrationPending = ref(false)
const pendingNickname = ref<string | null>(null)
let registrationWatcher: RegistrationStatusWatcher | null = null
const dropdownOverlayClass = ref('')
const dropdownZindexFixRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

const isAuthenticated = computed<boolean>(() => authStore.isUserAuthenticated)
const isAuthRestoring = computed<boolean>(() => authStore.isAuthRestoring)
const userAddress = computed(() => authStore.getUserAddress)
const userProfile = computed(() => authStore.getUserProfile)

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

const userName = computed<string>(() => {
  if (userProfile.value?.name) return userProfile.value.name
  // Показываем сохранённый ник, пока профиль не подтверждён в блокчейне.
  if (pendingNickname.value) return pendingNickname.value
  // Кэш ника из прошлой сессии — чтобы не мелькал обрезанный адрес,
  // пока fetchUserState поднимает свежий профиль.
  const cached = authStore.getCachedAccountName
  if (cached) return cached
  if (userAddress.value) return userAddress.value.substring(0, 8) + '...'
  return 'Пользователь'
})

const userAvatar = computed<string | null>(() => {
  // Сначала пытаемся взять из store, иначе — fallback на поля профиля.
  // resolveImageUrl внутри extractAvatarFromProfile нормализует домен и
  // достраивает URL от хэша.
  const fromStore = authStore.getUserAvatarUrl
  if (fromStore) return fromStore
  return extractAvatarFromProfile(userProfile.value) ?? null
})

const userBalance = computed<number | null>(() => {
  const profile = userProfile.value
  const balance = profile?.balance

  if (balance === null || balance === undefined) {
    // Альтернативные поля баланса (legacy/разные RPC-варианты).
    if (profile) {
      const p = profile as Record<string, unknown>
      const altBalance =
        (p.balance as number | undefined) ||
        (p.wallet as number | undefined) ||
        (p.amount as number | undefined) ||
        (p.bal as number | undefined) ||
        null
      if (altBalance !== null) return altBalance as number
    }
  }

  return (balance as number | undefined) ?? null
})

const userInitial = computed<string>(() => {
  if (userProfile.value?.name) return userProfile.value.name.charAt(0).toUpperCase()
  if (userAddress.value) return userAddress.value.charAt(0).toUpperCase()
  return 'U'
})

const isUserVerified = computed<boolean>(() => {
  const profile = userProfile.value as Record<string, unknown> | null
  if (!profile) return false
  const badges = profile.badges
  if (Array.isArray(badges)) {
    if (badges.includes('verificated') || badges.includes('verified')) return true
  }
  const flags = profile.flags as Record<string, unknown> | undefined
  const real = (flags?.real ?? profile.real) as unknown
  return real === 1 || real === '1' || real === true || real === 'true'
})

function openSignInModal(): void {
  signInModalOpen.value = true
}

function openRegisterModal(): void {
  registerModalOpen.value = true
}

function handleSignInSuccess(): void {
  signInModalOpen.value = false
  // Данные пользователя загружаются автоматически в auth-store после успешного входа.
}

function handleSignInCancel(): void {
  signInModalOpen.value = false
}

function handleOpenRegister(): void {
  registerModalOpen.value = true
  signInModalOpen.value = false
}

function handleRegisterSuccess(m: string): void {
  registerModalOpen.value = false
  if (m) {
    mnemonic.value = m
    mnemonicModalOpen.value = true
  }
  // Данные пользователя загружаются автоматически в auth-store после успешной регистрации.
}

function handleRegisterValidation(data: {
  status: string
  mnemonic: string | undefined
  nickname?: string
}): void {
  registerModalOpen.value = false

  if (data.mnemonic) mnemonic.value = data.mnemonic

  if (data.nickname) {
    pendingNickname.value = data.nickname
    try {
      localStorage.setItem('pending_nickname', data.nickname)
    } catch {
      /* ignore */
    }
  }

  validationStatus.value = data.status
  registrationPending.value = true
  validationModalOpen.value = true

  startRegistrationStatusCheck()
}

async function startRegistrationStatusCheck(): Promise<void> {
  registrationWatcher?.stop()
  registrationWatcher = createRegistrationStatusWatcher({
    onStatusUpdate: (status) => {
      debugLog('[header-user] Status check:', status)
      validationStatus.value = status
    },
    onComplete: async (status) => {
      debugLog('[header-user] Registration complete:', status)
      registrationPending.value = false
      pendingNickname.value = null
      try {
        localStorage.removeItem('pending_nickname')
        localStorage.removeItem('pending_registration')
      } catch {
        /* ignore */
      }
      validationModalOpen.value = false
      if (mnemonic.value) mnemonicModalOpen.value = true
      await authStore.fetchUserState()
    },
    onError: (err) => {
      console.error('Failed to check registration status:', err)
    },
  })
  await registrationWatcher.start()
}

function handleMnemonicModalClose(): void {
  mnemonicModalOpen.value = false
  mnemonic.value = ''
  privateKeyHex.value = ''
}

function handleRegisterCancel(): void {
  registerModalOpen.value = false
}

function handleOpenSignIn(): void {
  signInModalOpen.value = true
  registerModalOpen.value = false
}

function formatBalance(balance: number | null | undefined): string {
  // Хелпер конвертирует из минимальных единиц (аналог сатоши) в PKOIN.
  return formatPkoin(balance, 2, false)
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

function handleConfirmSignOut(): void {
  confirmSignOutOpen.value = false
  handleSignOut()
}

function handleCancelSignOut(): void {
  confirmSignOutOpen.value = false
}

/**
 * Повторяет фоновую отправку транзакции регистрации. Вызывается при
 * перезагрузке, если в localStorage висит step=2 (free/balance отправлен,
 * tx ещё нет).
 */
async function retryBackgroundTransaction(nickname: string): Promise<void> {
  const outcome = await retryRegistrationBackgroundTx({
    address: authStore.getUserAddress,
    keyPair: authStore.getKeyPair,
    nickname,
  })
  if (outcome === 'fatal') {
    // Хелпер уже очистил localStorage; снимаем pending в UI.
    registrationPending.value = false
    pendingNickname.value = null
  }
}

function onAvatarClick(): void {
  if (registrationPending.value) validationModalOpen.value = true
}

function handleValidationModalUpdate(value: boolean): void {
  validationModalOpen.value = value
  // НЕ останавливаем polling при закрытии модалки — проверка продолжается,
  // пока `registrationPending` истинен.
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

async function checkRegistrationStatusOnLoad(): Promise<void> {
  if (!isAuthenticated.value) return

  // Восстанавливаем pending nickname из localStorage.
  try {
    const savedNickname = localStorage.getItem('pending_nickname')
    if (savedNickname) {
      pendingNickname.value = savedNickname
      debugLog('[header-user] Restored pending nickname:', savedNickname)
    }
  } catch {
    /* ignore */
  }

  // Быстрая проверка: если есть pending_nickname — сразу ставим pending
  // (до async RPC-вызова, чтобы часики появились мгновенно).
  if (pendingNickname.value) registrationPending.value = true

  try {
    const { getRegistrationStatus, isRegistrationInProgress } =
      await import('@/blockchain/api/registration-status')
    const status = await getRegistrationStatus()
    debugLog('[header-user] Registration status on load:', status)

    if (isRegistrationInProgress(status)) {
      validationStatus.value = status
      registrationPending.value = true
      startRegistrationStatusCheck()

      // Если транзакция ещё не отправлена (step=2), запускаем фоновую отправку.
      try {
        const pendingRaw = localStorage.getItem('pending_registration')
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw)
          if (pending && pending.step >= 2 && pending.step < 3 && pending.nickname) {
            debugLog('[header-user] Resuming background transaction for:', pending.nickname)
            retryBackgroundTransaction(pending.nickname)
          }
        }
      } catch {
        /* ignore */
      }
    } else {
      // Регистрация завершена — очищаем pending.
      debugLog('[header-user] Registration complete, clearing pending')
      registrationPending.value = false
      pendingNickname.value = null
      try {
        localStorage.removeItem('pending_nickname')
        localStorage.removeItem('pending_registration')
      } catch {
        /* ignore */
      }
      // Обновляем профиль, чтобы подтянуть имя.
      authStore.fetchUserState().catch(() => {})
    }
  } catch (error) {
    console.error('Failed to check registration status on load:', error)
    // При ошибке: если есть pending_nickname — оставляем pending (лучше
    // показать часики, чем потерять статус).
    if (pendingNickname.value) {
      registrationPending.value = true
      startRegistrationStatusCheck()
    }
  }
}

async function checkAndShowMnemonic(): Promise<void> {
  const address = authStore.getUserAddress
  if (!address || !isAuthenticated.value) return
  if (!shouldShowMnemonic(address)) return

  const result = await loadPendingMnemonic()
  if (!result) return

  mnemonic.value = result.mnemonic
  privateKeyHex.value = result.privateKeyHex
  setTimeout(() => {
    mnemonicModalOpen.value = true
  }, 3000)
}

onMounted(async () => {
  const r = dropdownZindexFixRef.value
  const el = r && ('$el' in r ? r.$el : r)
  dropdownOverlayClass.value = el?.className ?? ''

  // fetchUserState вызывается внутри restoreSession.
  await authStore.restoreSession()

  await checkRegistrationStatusOnLoad()
  checkAndShowMnemonic()
})

// Синхронизация состояния модалок авторизации с глобальным store.
watch(
  () => modalStore.authModal.isOpen,
  (isOpen) => {
    if (isOpen) {
      if (modalStore.authModal.mode === 'login') {
        signInModalOpen.value = true
        registerModalOpen.value = false
      } else {
        registerModalOpen.value = true
        signInModalOpen.value = false
      }
    } else {
      signInModalOpen.value = false
      registerModalOpen.value = false
    }
  }
)

// Если пользователь закрыл модалку вручную — закрываем и в store.
watch(signInModalOpen, (isOpen) => {
  if (!isOpen && modalStore.authModal.isOpen && modalStore.authModal.mode === 'login') {
    modalStore.closeAuthModal()
  }
})

watch(registerModalOpen, (isOpen) => {
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
</script>
