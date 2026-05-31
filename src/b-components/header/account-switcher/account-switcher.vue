<template>
  <Modal
    v-model:open="isOpen"
    :title="t('accounts.switchAccount')"
    :width="500"
    :centered="true"
    :closable="true"
    :mask-closable="true"
    :destroy-on-close="true"
    :z-index="2600"
    @cancel="handleCancel"
  >
    <SC_AccountSwitcher>
      <SC_EmptyState v-if="accounts.length === 0">
        <p>{{ t('accounts.noSavedAccounts') }}</p>
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

              <SC_AccountBalance v-if="account.balance !== null && account.balance !== undefined">
                {{ formatBalance(account.balance) }} PKOIN
              </SC_AccountBalance>

              <SC_AccountLoading v-else-if="account.loading"> {{ t('accounts.loading') }} </SC_AccountLoading>
            </SC_AccountInfo>

            <SC_AccountBadge v-if="account.address === currentAddress"> {{ t('accounts.current') }} </SC_AccountBadge>
          </SC_AccountItemContent>

          <SC_AccountActions>
            <SC_KeyIcon
              :title="t('accounts.showSeedPhrase')"
              @click.stop="handleShowMnemonic(account.address)"
            >
              <img :src="keyIcon" alt="Key" />
            </SC_KeyIcon>
            <SC_LogoutIcon :title="t('accounts.logout')" @click.stop="handleDeleteAccount(account.address)">
              <LogoutOutlined />
            </SC_LogoutIcon>
          </SC_AccountActions>
        </SC_AccountItem>
      </SC_AccountsList>

      <SC_AddAccountSection>
        <Button type="primary" block :loading="addingAccount" @click="handleAddAccount">
          {{ t('accounts.addAccount') }}
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
      :private-key-hex="privateKeyHex"
      @close="handleMnemonicModalClose"
    />
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogoutOutlined } from '@ant-design/icons-vue'
import Modal from '@/components/modal/modal.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Button from '@/components/button/button.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import ConfirmDeleteModal from './confirm-delete-modal.vue'
import ConfirmShowMnemonicModal from './confirm-show-mnemonic-modal.vue'
import { useAuthStore } from '@/blockchain'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import type { Address } from '@/blockchain/types/addresses'
import type { AccountDisplayInfo } from './types'
import { loadAccounts as loadAccountsHelper } from './helpers/load-accounts'
import { loadAccountMnemonic } from './helpers/load-account-mnemonic'
import keyIcon from './key-icon.svg?url'
import {
  SC_AccountSwitcher,
  SC_EmptyState,
  SC_AccountsList,
  SC_AccountItem,
  SC_AccountInfo,
  SC_AccountName,
  SC_AccountBalance,
  SC_AccountLoading,
  SC_AccountBadge,
  SC_AddAccountSection,
  SC_AccountActions,
  SC_AccountItemContent,
  SC_KeyIcon,
  SC_LogoutIcon,
} from './styled'

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false })

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const { t } = useI18n()

const authStore = useAuthStore()

const accounts = ref<AccountDisplayInfo[]>([])
const signInModalOpen = ref(false)
const addingAccount = ref(false)
const confirmDeleteOpen = ref(false)
const confirmShowMnemonicOpen = ref(false)
const mnemonicModalOpen = ref(false)
const mnemonic = ref('')
const privateKeyHex = ref('')
const selectedAccountAddress = ref<Address | null>(null)

const isOpen = computed<boolean>({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

const currentAddress = computed<Address | null>(() => authStore.getUserAddress)

async function loadAccounts(): Promise<void> {
  accounts.value = await loadAccountsHelper({
    accountsInfo: authStore.getAccountsInfo(),
    currentAddress: authStore.getUserAddress,
    currentUserProfile: authStore.getUserProfile,
  })
}

function formatAddress(address: Address): string {
  if (!address) return t('accounts.user')
  return address.substring(0, 8) + '...'
}

function accountInitial(address: Address): string {
  if (!address) return 'U'
  return address.charAt(0).toUpperCase()
}

function formatBalance(balance: number | null | undefined): string {
  return formatPkoin(balance, 2, false)
}

async function handleSelectAccount(address: Address): Promise<void> {
  if (address === currentAddress.value) return

  addingAccount.value = true
  try {
    const result = await authStore.switchAccount(address)
    if (result.success) handleCancel()
  } catch (error) {
    console.error('Failed to switch account:', error)
  } finally {
    addingAccount.value = false
  }
}

function handleAddAccount(): void {
  signInModalOpen.value = true
}

function handleSignInSuccess(): void {
  signInModalOpen.value = false
  loadAccounts()
}

function handleSignInCancel(): void {
  signInModalOpen.value = false
}

function handleCancel(): void {
  emit('close')
  emit('update:open', false)
}

function handleShowMnemonic(address: Address): void {
  selectedAccountAddress.value = address
  confirmShowMnemonicOpen.value = true
}

async function handleConfirmShowMnemonic(): Promise<void> {
  confirmShowMnemonicOpen.value = false

  const address = selectedAccountAddress.value
  if (!address) {
    console.error('Failed to load mnemonic: No account address selected')
    return
  }

  try {
    const { mnemonic: m, privateKeyHex: pk } = await loadAccountMnemonic(address)
    mnemonic.value = m
    privateKeyHex.value = pk
    mnemonicModalOpen.value = true
  } catch (error) {
    console.error('Failed to load mnemonic:', error)
  }
}

function handleCancelShowMnemonic(): void {
  confirmShowMnemonicOpen.value = false
  selectedAccountAddress.value = null
}

function handleMnemonicModalClose(): void {
  mnemonicModalOpen.value = false
  mnemonic.value = ''
  privateKeyHex.value = ''
  selectedAccountAddress.value = null
}

function handleDeleteAccount(address: Address): void {
  selectedAccountAddress.value = address
  confirmDeleteOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  confirmDeleteOpen.value = false

  try {
    const address = selectedAccountAddress.value
    if (!address) throw new Error('No account address selected')

    const success = await authStore.removeAccount(address)
    if (!success) throw new Error('Failed to remove account')

    await loadAccounts()
    // Если аккаунтов не осталось — закрываем модалку.
    if (accounts.value.length === 0) handleCancel()
  } catch (error) {
    console.error('Failed to remove account:', error)
  }
}

function handleCancelDelete(): void {
  confirmDeleteOpen.value = false
  selectedAccountAddress.value = null
}

watch(
  () => props.open,
  (newValue) => {
    if (newValue) loadAccounts()
  }
)

onMounted(() => {
  if (props.open) loadAccounts()
})
</script>
