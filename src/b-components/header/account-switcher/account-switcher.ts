import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Button from '@/components/button/button.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import ConfirmDeleteModal from './confirm-delete-modal.vue'
import ConfirmShowMnemonicModal from './confirm-show-mnemonic-modal.vue'
import { KeyOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { extractAvatarFromProfile } from '@/helpers/common/profile-avatar'
import type { Address } from '@/blockchain/types/addresses'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type { AccountDisplayInfo, Props } from './types'
import { loadAccounts } from './helpers/load-accounts'
import { loadAccountMnemonic } from './helpers/load-account-mnemonic'
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

export const accountSwitcherOptions = defineComponent({
  name: 'AccountSwitcher',
  components: {
    Modal,
    Avatar,
    // eslint-disable-next-line vue/no-reserved-component-names
    Button,
    SignInModal,
    MnemonicModal,
    ConfirmDeleteModal,
    ConfirmShowMnemonicModal,
    KeyOutlined,
    LogoutOutlined,
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
  },
  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:open', 'close'],
  setup(_p: Props, { emit }: { emit: (event: 'update:open' | 'close', ...args: any[]) => void }) {
    const authStore = useAuthStore()

    return {
      authStore,
      emit,
    }
  },
  data() {
    return {
      accounts: [] as AccountDisplayInfo[],
      signInModalOpen: false,
      addingAccount: false,
      confirmDeleteOpen: false,
      confirmShowMnemonicOpen: false,
      mnemonicModalOpen: false,
      mnemonic: '',
      privateKeyHex: '',
      selectedAccountAddress: null as Address | null,
    }
  },
  computed: {
    isOpen: {
      get(): boolean {
        return this.open ?? false
      },
      set(value: boolean) {
        this.$emit('update:open', value)
      },
    },
    currentAddress(): Address | null {
      return this.authStore.getUserAddress
    },
  },
  watch: {
    open(newValue: boolean) {
      if (newValue) {
        this.loadAccounts()
      }
    },
  },
  methods: {
    // Загружаем список аккаунтов и их данные (вся логика — в helpers/load-accounts.ts).
    async loadAccounts() {
      this.accounts = await loadAccounts({
        accountsInfo: this.authStore.getAccountsInfo(),
        currentAddress: this.authStore.getUserAddress,
        currentUserProfile: this.authStore.getUserProfile,
      })
    },

    // Получает URL аватарки из профиля (общий хелпер с header-user / chat-room).
    getAvatarUrl(profile: UserProfile | null): string | null {
      return extractAvatarFromProfile(profile) ?? null
    },

    // Форматирует адрес для отображения
    formatAddress(address: Address): string {
      if (!address) return 'Пользователь'
      return address.substring(0, 8) + '...'
    },

    // Получает первую букву для аватарки
    accountInitial(address: Address): string {
      if (!address) return 'U'
      return address.charAt(0).toUpperCase()
    },

    // Форматирует баланс
    formatBalance(balance: number | null | undefined): string {
      return formatPkoin(balance, 2, false)
    },

    // Обработчик выбора аккаунта
    async handleSelectAccount(address: Address) {
      if (address === this.currentAddress) {
        return
      }

      this.addingAccount = true
      try {
        const result = await this.authStore.switchAccount(address)
        if (result.success) {
          this.handleCancel()
        }
      } catch (error) {
        console.error('Failed to switch account:', error)
      } finally {
        this.addingAccount = false
      }
    },

    // Обработчик добавления аккаунта
    handleAddAccount() {
      this.signInModalOpen = true
    },

    // Обработчик успешного входа
    handleSignInSuccess() {
      this.signInModalOpen = false
      // Перезагружаем список аккаунтов
      this.loadAccounts()
    },

    // Обработчик отмены входа
    handleSignInCancel() {
      this.signInModalOpen = false
    },

    // Обработчик закрытия модалки
    handleCancel() {
      this.$emit('close')
      this.$emit('update:open', false)
    },

    // Обработчик нажатия на кнопку "Показать сид-фразу"
    handleShowMnemonic(address: Address) {
      this.selectedAccountAddress = address
      this.confirmShowMnemonicOpen = true
    },

    // Обработчик подтверждения показа сид-фразы
    async handleConfirmShowMnemonic() {
      this.confirmShowMnemonicOpen = false

      const address = this.selectedAccountAddress
      if (!address) {
        console.error('Failed to load mnemonic: No account address selected')
        return
      }

      try {
        const { mnemonic, privateKeyHex } = await loadAccountMnemonic(address)
        this.mnemonic = mnemonic
        this.privateKeyHex = privateKeyHex
        this.mnemonicModalOpen = true
      } catch (error) {
        console.error('Failed to load mnemonic:', error)
      }
    },

    // Обработчик отмены показа сид-фразы
    handleCancelShowMnemonic() {
      this.confirmShowMnemonicOpen = false
      this.selectedAccountAddress = null
    },

    // Обработчик закрытия модалки с мнемоникой
    handleMnemonicModalClose() {
      this.mnemonicModalOpen = false
      this.mnemonic = ''
      this.privateKeyHex = ''
      this.selectedAccountAddress = null
    },

    // Обработчик нажатия на кнопку "Удалить аккаунт"
    handleDeleteAccount(address: Address) {
      this.selectedAccountAddress = address
      this.confirmDeleteOpen = true
    },

    // Обработчик подтверждения удаления
    async handleConfirmDelete() {
      this.confirmDeleteOpen = false

      try {
        const address = this.selectedAccountAddress
        if (!address) {
          throw new Error('No account address selected')
        }

        // Удаляем аккаунт
        const success = await this.authStore.removeAccount(address)

        if (success) {
          // Перезагружаем список аккаунтов
          this.loadAccounts()

          // Если аккаунтов не осталось, закрываем модалку
          if (this.accounts.length === 0) {
            this.handleCancel()
          }
        } else {
          throw new Error('Failed to remove account')
        }
      } catch (error) {
        console.error('Failed to remove account:', error)
        // Можно показать уведомление об ошибке
      }
    },

    // Обработчик отмены удаления
    handleCancelDelete() {
      this.confirmDeleteOpen = false
      this.selectedAccountAddress = null
    },
  },
  mounted() {
    if (this.open) {
      this.loadAccounts()
    }
  },
})
