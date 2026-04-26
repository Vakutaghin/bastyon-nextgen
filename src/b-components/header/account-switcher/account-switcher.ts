import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Avatar from '@/components/avatar/avatar.vue'
import Button from '@/components/button/button.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import ConfirmDeleteModal from './confirm-delete-modal.vue'
import ConfirmShowMnemonicModal from './confirm-show-mnemonic-modal.vue'
import { KeyOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { useAuthStore, recoverKeyPair, detectPrivateKeyFormat } from '@/blockchain'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { loadEncryptedMnemonic } from '@/blockchain/storage'
import { ACCOUNT_STORAGE_PREFIX } from '@/blockchain/constants/storage'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import type { Address } from '@/blockchain/types/addresses'
import type { UserProfile, GetUserProfileResponse } from '@/types/rpc-responses/user-get'
import type { AccountDisplayInfo, Props } from './types'
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
  setup(
    _p: Props,
    { emit }: { emit: (event: 'update:open' | 'close', ...args: any[]) => void },
  ) {
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
    // Загружаем список аккаунтов и их данные из стора
    async loadAccounts() {
      const accountsInfo = this.authStore.getAccountsInfo()
      const currentAddress = this.authStore.getUserAddress
      const currentUserProfile = this.authStore.getUserProfile

      // Инициализируем массив аккаунтов с данными из стора
      this.accounts = accountsInfo.map((acc) => {
        // Для текущего пользователя используем данные из стора
        if (acc.address === currentAddress && currentUserProfile) {
          const badges = (currentUserProfile as any)?.badges
          const verified =
            Array.isArray(badges) &&
            ((badges.includes('verificated') ||
              badges.includes('verified')))
            || (() => {
              const flags = (currentUserProfile as any)?.flags
              const real = (flags && (flags as any).real) ?? (currentUserProfile as any)?.real
              return real === 1 || real === '1' || real === true || real === 'true'
            })()
          return {
            address: acc.address,
            name: currentUserProfile.name || acc.name || null,
            avatar: this.getAvatarUrl(currentUserProfile as UserProfile),
            balance: (currentUserProfile as any).balance ?? null,
            loading: false,
            verified
          }
        }

        // Для других аккаунтов используем только базовую информацию из стора
        // И ставим флаг загрузки, так как будем подгружать данные
        return {
          address: acc.address,
          name: acc.name || null,
          avatar: null,
          balance: null,
          loading: true,
          verified: false
        }
      })

      // Получаем список адресов для обновления данных
      // Исключаем текущего пользователя, если его профиль уже загружен в сторе
      const addresses = accountsInfo
        .map((acc) => acc.address)
        .filter((addr) => {
          if (addr === currentAddress && currentUserProfile) return false
          return true
        })

      if (addresses.length === 0) return

      try {
        // Запрашиваем профили для всех аккаунтов
        // Добавляем cachehash для обхода кэша и получения актуального баланса
        const cachehash = Date.now().toString(36) + Math.random().toString(36).substring(2)

        const response = await getByPRCWithAuth({
          method: rpcEndpoints.getUserProfile,
          parameters: [addresses],
          cachehash,
          options: {
            auth: false, // Не требуем авторизации для получения публичных данных
          },
        }) as GetUserProfileResponse

        if (response.result === 'success' && response.data) {
          // Обновляем данные аккаунтов
          this.accounts = this.accounts.map((acc) => {
            const profile = response.data.find((p) => p && p.address === acc.address)

            if (profile) {
              const badges = (profile as any)?.badges
              const verified =
                Array.isArray(badges) &&
                ((badges.includes('verificated') ||
                  badges.includes('verified')))
                || (() => {
                  const flags = (profile as any)?.flags
                  const real = (flags && (flags as any).real) ?? (profile as any)?.real
                  return real === 1 || real === '1' || real === true || real === 'true'
                })()
              // Если это текущий аккаунт, берем данные из профиля, но сохраняем приоритет стора если нужно
              // В данном случае данные из API свежие
              return {
                address: acc.address,
                name: profile.name || acc.name || null,
                avatar: this.getAvatarUrl(profile),
                balance: profile.balance ?? acc.balance ?? null,
                loading: false,
                verified
              }
            }

            // Если профиль не найден, просто снимаем флаг загрузки
            return {
              ...acc,
              loading: false,
            }
          })
        } else {
          // В случае ошибки API снимаем флаги загрузки
          this.accounts = this.accounts.map(acc => ({ ...acc, loading: false }))
        }
      } catch (error) {
        console.error('Failed to fetch accounts profiles:', error)
        this.accounts = this.accounts.map(acc => ({ ...acc, loading: false }))
      }
    },

    // Получает URL аватарки из профиля
    getAvatarUrl(profile: UserProfile | null): string | null {
      if (!profile) return null

      let avatarUrl = (profile as any).i || null

      if (!avatarUrl) {
        const possibleFields = ['avatar', 'image', 'img', 'avatarUrl', 'avatar_url']
        for (const field of possibleFields) {
          const value = (profile as any)[field]
          if (value) {
            avatarUrl = value
            break
          }
        }
      }

      // Если это не полный URL, преобразуем в полный
      if (avatarUrl && typeof avatarUrl === 'string' && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        avatarUrl = `https://bastyon.com:8092/i/${avatarUrl}`
      }

      return avatarUrl || null
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

      try {
        // Получаем мнемонику для выбранного аккаунта
        const address = this.selectedAccountAddress
        if (!address) {
          throw new Error('No account address selected')
        }

        // Получаем информацию об аккаунте
        const accountsList = this.authStore.getAccountsList()
        const accountInfo = accountsList.accounts.find((acc) => acc.address === address)

        if (!accountInfo) {
          throw new Error('Account not found')
        }

        // Загружаем мнемонику
        const { loadEncryptedData } = await import('@/blockchain/storage')
        const mnemonicResult = loadEncryptedData({
          persistent: true,
          storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
        })

        const rawData = mnemonicResult.success && mnemonicResult.data
          ? mnemonicResult.data
          : (() => {
              const generalResult = loadEncryptedMnemonic()
              if (generalResult.success && generalResult.data) return generalResult.data
              return null
            })()

        if (!rawData || !rawData.trim()) {
          throw new Error('Нет сохранённой сид-фразы или ключа для этого аккаунта')
        }

        const format = detectPrivateKeyFormat(rawData.trim())
        if (format === 'mnemonic') {
          this.mnemonic = rawData.trim()
          this.privateKeyHex = ''
        } else if (format === 'hex') {
          this.mnemonic = ''
          this.privateKeyHex = rawData.trim()
        } else if (format === 'wif') {
          try {
            const { keyPair } = recoverKeyPair(rawData.trim())
            this.mnemonic = ''
            this.privateKeyHex = keyPair?.privateKey
              ? (Buffer.isBuffer(keyPair.privateKey) ? keyPair.privateKey.toString('hex') : String(keyPair.privateKey))
              : ''
          } catch {
            throw new Error('Не удалось прочитать ключ')
          }
        } else {
          throw new Error('Неизвестный формат данных')
        }
        this.mnemonicModalOpen = true
      } catch (error) {
        console.error('Failed to load mnemonic:', error)
        // Можно показать уведомление об ошибке
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
