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
    <Button type="default" @click="openSignInModal"> {{ t('header.signIn') }} </Button>

    <Button type="default" @click="openRegisterModal"> {{ t('header.register') }} </Button>
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
            {{ t('header.loading') }}
          </SC_UserLoading>
        </SC_UserDetails>
      </SC_UserInfoTrigger>

      <template #overlay>
        <Menu :items="menuItems" @click="handleMenuClick" />
      </template>
    </Dropdown>
  </template>
  <SC_HeaderDropdownZindexFix ref="dropdownZindexFixRef" aria-hidden="true" />

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

  <WelcomeModal
    v-model:open="welcomeModalOpen"
    :nickname="pendingNickname || ''"
    @close="handleWelcomeClose"
  />

  <AccountSwitcher v-model:open="accountSwitcherOpen" @close="handleAccountSwitcherClose" />

  <ConfirmSignOutModal
    v-model:open="confirmSignOutOpen"
    @confirm="handleConfirmSignOut"
    @cancel="handleCancelSignOut"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu } from 'ant-design-vue'
import Button from '@/components/button/button.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import RegisterModal from '@/b-components/header/register-modal/register-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import WelcomeModal from '@/b-components/header/welcome-modal/welcome-modal.vue'
import AccountSwitcher from '@/b-components/header/account-switcher/account-switcher.vue'
import ConfirmSignOutModal from '@/b-components/header/confirm-sign-out-modal/confirm-sign-out-modal.vue'
import RegistrationValidationModal from '@/b-components/header/registration-validation-modal/registration-validation-modal.vue'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { extractAvatarFromProfile } from '@/helpers/common/profile-avatar'
import { useRegistrationFlow } from './use-registration-flow'
import { useAccountMenu } from './use-account-menu'
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

const { t } = useI18n()

const authStore = useAuthStore()
const modalStore = useModalStore()
const router = useRouter()

const isAuthenticated = computed<boolean>(() => authStore.isUserAuthenticated)
const isAuthRestoring = computed<boolean>(() => authStore.isAuthRestoring)
const userAddress = computed(() => authStore.getUserAddress)
const userProfile = computed(() => authStore.getUserProfile)

const dropdownOverlayClass = ref('')
const dropdownZindexFixRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

// === Регистрация ===
const {
  registerModalOpen,
  mnemonicModalOpen,
  mnemonic,
  privateKeyHex,
  validationModalOpen,
  validationStatus,
  registrationPending,
  pendingNickname,
  welcomeModalOpen,
  handleWelcomeClose,
  openRegisterModal,
  handleRegisterSuccess,
  handleRegisterValidation,
  handleRegisterCancel,
  handleMnemonicModalClose,
  handleValidationModalUpdate,
  onAvatarClick,
} = useRegistrationFlow({ authStore, isAuthenticated })

// === Меню профиля + sign-in / sign-out ===
const {
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
} = useAccountMenu({
  authStore,
  modalStore,
  router,
  openRegister: openRegisterModal,
  registerModalOpenRef: registerModalOpen,
})

// === Отображение пользователя в шапке ===
const userName = computed<string>(() => {
  if (userProfile.value?.name) return userProfile.value.name
  // Показываем сохранённый ник, пока профиль не подтверждён в блокчейне.
  if (pendingNickname.value) return pendingNickname.value
  // Кэш ника из прошлой сессии — чтобы не мелькал обрезанный адрес,
  // пока fetchUserState поднимает свежий профиль.
  const cached = authStore.getCachedAccountName
  if (cached) return cached
  if (userAddress.value) return userAddress.value.substring(0, 8) + '...'
  return t('header.user')
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

function formatBalance(balance: number | null | undefined): string {
  // Хелпер конвертирует из минимальных единиц (аналог сатоши) в PKOIN.
  return formatPkoin(balance, 2, false)
}

onMounted(() => {
  const r = dropdownZindexFixRef.value
  const el = r && ('$el' in r ? r.$el : r)
  dropdownOverlayClass.value = el?.className ?? ''
})
</script>
