<template>
  <template v-if='isAuthRestoring'>
    <SC_AuthSkeleton aria-hidden='true'>
      <Skeleton :width='32' :height='32' :radius='16' />
      <SC_SkeletonLines>
        <Skeleton :width='90' :height='12' :radius='4' />
        <Skeleton :width='60' :height='10' :radius='4' />
      </SC_SkeletonLines>
    </SC_AuthSkeleton>
  </template>
  <template v-else-if='!isAuthenticated'>
    <Button type='default' @click='openSignInModal'>
      Войти
    </Button>

    <Button type='default' @click='openRegisterModal'>
      Регистрация
    </Button>
  </template>
  <template v-else>
    <Dropdown
      :trigger="['click']"
      placement="bottomRight"
      :overlayClassName="dropdownOverlayClass"
    >
      <SC_UserInfoTrigger>
        <!-- DEBUG: userAvatar = {{ userAvatar ? 'HAS_URL' : 'NULL' }} -->
        <Avatar
          :src='userAvatar'
          :alt='userInitial'
          :fallback-text='userName'
          :size='32'
          :verified="isUserVerified"
          :pending="registrationPending"
          data-header-avatar="true"
          @click.stop="onAvatarClick"
        />

        <SC_UserDetails>
          <SC_UserName>{{ userName }}</SC_UserName>

          <SC_UserBalance v-if='typeof userBalance === "number"'>
            {{ formatBalance(userBalance) }} PKOIN
          </SC_UserBalance>

          <SC_UserLoading v-else-if='authStore.isLoading || authStore.isFetchingUserState'>
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
    style="position: absolute; left: -9999px; visibility: hidden; pointer-events: none;"
    aria-hidden="true"
  />

  <SignInModal
    v-model:open='signInModalOpen'
    @success='handleSignInSuccess'
    @cancel='handleSignInCancel'
    @openRegister='handleOpenRegister'
  />

  <RegisterModal
    v-model:open='registerModalOpen'
    @success='handleRegisterSuccess'
    @validation='handleRegisterValidation'
    @cancel='handleRegisterCancel'
    @openSignIn='handleOpenSignIn'
  />

  <RegistrationValidationModal
    v-model:open='validationModalOpen'
    :status='validationStatus'
    @update:open='handleValidationModalUpdate'
  />

  <MnemonicModal
    v-model:open='mnemonicModalOpen'
    :mnemonic='mnemonic'
    :privateKeyHex='privateKeyHex'
    @close='handleMnemonicModalClose'
  />

  <AccountSwitcher
    v-model:open='accountSwitcherOpen'
    @close='handleAccountSwitcherClose'
  />

  <ConfirmSignOutModal
    v-model:open='confirmSignOutOpen'
    @confirm='handleConfirmSignOut'
    @cancel='handleCancelSignOut'
  />
</template>

<script>
import { headerUserOptions } from './header-user.ts'

export default headerUserOptions
</script>
