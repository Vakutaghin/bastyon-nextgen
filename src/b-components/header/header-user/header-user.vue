<template>
  <template v-if='!isAuthenticated'>
    <Button type='default' @click='openSignInModal'>
      {{ userData.loginText }}
    </Button>

    <Button type='default' @click='openRegisterModal'>
      {{ userData.registerText }}
    </Button>
  </template>
  <Dropdown
    v-else
    :trigger="['click']"
    placement="bottomRight"
    overlayClassName="header-dropdown-zindex-fix"
  >
    <SC_UserInfoTrigger>
      <!-- DEBUG: userAvatar = {{ userAvatar ? 'HAS_URL' : 'NULL' }} -->
      <Avatar
        :src='userAvatar'
        :alt='userInitial'
        :fallback-text='userName'
        :size='32'
        :verified="isUserVerified"
        data-header-avatar="true"
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
    @close='handleMnemonicModalClose'
    @dontShowAgain='handleDontShowMnemonicAgain'
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

<style>
.header-dropdown-zindex-fix {
  z-index: 3005 !important;
}
</style>
