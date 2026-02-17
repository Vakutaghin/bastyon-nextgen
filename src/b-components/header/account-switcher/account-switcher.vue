<template>
  <Modal
    v-model:open="isOpen"
    title="Сменить аккаунт"
    :width="500"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :destroyOnClose="true"
    :z-index="2600"
    @cancel="handleCancel"
  >
    <SC_AccountSwitcher>
      <SC_EmptyState v-if="accounts.length === 0">
        <p>Нет сохраненных аккаунтов</p>
      </SC_EmptyState>

      <SC_AccountsList v-else>
        <SC_AccountItem
          v-for="account in accounts"
          :key="account.address"
          :active="account.address === currentAddress"
          @click="handleSelectAccount(account.address)"
        >
          <Avatar
            :src="account.avatar"
            :alt="account.name || accountInitial(account.address)"
            :fallback-text="account.name"
            :size="40"
            :verified="account.verified"
          />
          <SC_AccountItemContent>
            <SC_AccountInfo>
              <SC_AccountName>
                {{ account.name || formatAddress(account.address) }}
              </SC_AccountName>

              <SC_AccountBalance
                v-if="account.balance !== null && account.balance !== undefined"
              >
                {{ formatBalance(account.balance) }} PKOIN
              </SC_AccountBalance>

              <SC_AccountLoading v-else-if="account.loading">
                Загрузка...
              </SC_AccountLoading>
            </SC_AccountInfo>

            <SC_AccountBadge v-if="account.address === currentAddress">
              Текущий
            </SC_AccountBadge>
          </SC_AccountItemContent>

          <!-- Кнопки действий для всех аккаунтов -->
          <SC_AccountActions>
            <SC_KeyIcon
              title="Показать сид-фразу"
              @click.stop="handleShowMnemonic(account.address)"
            >
              <img :src="keyIcon" alt="Key" />
            </SC_KeyIcon>
            <SC_LogoutIcon
              title="Выйти"
              @click.stop="handleDeleteAccount(account.address)"
            >
              <LogoutOutlined />
            </SC_LogoutIcon>
          </SC_AccountActions>
        </SC_AccountItem>
      </SC_AccountsList>

      <SC_AddAccountSection>
        <Button
          type="primary"
          block
          @click="handleAddAccount"
          :loading="addingAccount"
        >
          + Добавить аккаунт
        </Button>
      </SC_AddAccountSection>
    </SC_AccountSwitcher>

    <SignInModal
      v-model:open="signInModalOpen"
      @success="handleSignInSuccess"
      @cancel="handleSignInCancel"
    />

    <ConfirmDeleteModal
      v-model:open="confirmDeleteOpen"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />

    <ConfirmShowMnemonicModal
      v-model:open="confirmShowMnemonicOpen"
      @confirm="handleConfirmShowMnemonic"
      @cancel="handleCancelShowMnemonic"
    />

    <MnemonicModal
      v-model:open="mnemonicModalOpen"
      :mnemonic="mnemonic"
      :privateKeyHex="privateKeyHex"
      @close="handleMnemonicModalClose"
    />
  </Modal>
</template>

<script>
import { accountSwitcherOptions } from './account-switcher.ts'
import keyIcon from './key-icon.svg?url'

const options = { ...accountSwitcherOptions }

// Добавляем keyIcon в data
const originalData = options.data

options.data = function() {
  const original = typeof originalData === 'function' ? originalData() : originalData

  return {
    ...original,
    keyIcon
  }
}

export default options
</script>
