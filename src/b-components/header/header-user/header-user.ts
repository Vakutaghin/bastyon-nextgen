import { defineComponent } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
import Button from '@/components/button/button.vue'
import Avatar from '@/components/avatar/avatar.vue'
import SignInModal from '@/b-components/header/sign-in-modal/sign-in-modal.vue'
import RegisterModal from '@/b-components/header/register-modal/register-modal.vue'
import MnemonicModal from '@/b-components/header/mnemonic-modal/mnemonic-modal.vue'
import AccountSwitcher from '@/b-components/header/account-switcher/account-switcher.vue'
import ConfirmSignOutModal from '@/b-components/header/confirm-sign-out-modal/confirm-sign-out-modal.vue'
import RegistrationValidationModal from '@/b-components/header/registration-validation-modal/registration-validation-modal.vue'
import { userData } from '@/b-components/header/dummy-data/user-data'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { shouldShowMnemonic, setDontShowMnemonic } from '@/helpers/common/mnemonic-storage'
import {
  SC_UserDetails,
  SC_UserName,
  SC_UserBalance,
  SC_UserLoading,
  SC_UserInfoTrigger,
  SC_HeaderDropdownZindexFix,
} from './styled'

export const headerUserOptions = defineComponent({
  name: 'HeaderUser',
  components: {
    Dropdown,
    Menu,
    Button,
    Avatar,
    SignInModal,
    RegisterModal,
    MnemonicModal,
    AccountSwitcher,
    ConfirmSignOutModal,
    RegistrationValidationModal,
    SC_UserDetails,
    SC_UserName,
    SC_UserBalance,
    SC_UserLoading,
    SC_UserInfoTrigger,
    SC_HeaderDropdownZindexFix,
  },
  setup() {
    const authStore = useAuthStore()
    const modalStore = useModalStore()
    const isDev = import.meta.env.DEV

    return {
      authStore,
      modalStore,
      isDev,
    }
  },
  data() {
    return {
      userData,
      signInModalOpen: false,
      registerModalOpen: false,
      mnemonicModalOpen: false,
      mnemonic: '',
      accountSwitcherOpen: false,
      confirmSignOutOpen: false,
      validationModalOpen: false,
      validationStatus: null as string | null,
      registrationStatusCheckInterval: null as NodeJS.Timeout | null,
      dropdownOverlayClass: '',
    }
  },
  computed: {
    menuItems() {
      return [
        { key: this.profileLink, label: 'Профиль' },
        { key: '/wallets', label: 'Кошельки' },
        { key: '/limits', label: 'Лимиты' },
        { key: 'settings', label: 'Настройки' },
        { type: 'divider' },
        { key: 'switchAccount', label: 'Сменить аккаунт' },
        { key: 'signout', label: 'Выйти', danger: true },
      ]
    },
    profileLink() {
      if (this.userProfile?.name) {
        return '/' + this.userProfile.name.toLowerCase()
      }
      if (this.userAddress) {
        return '/' + this.userAddress
      }
      return '/'
    },
    isAuthenticated() {
      return this.authStore.isUserAuthenticated
    },
    userAddress() {
      return this.authStore.getUserAddress
    },
    userProfile() {
      return this.authStore.getUserProfile
    },
    userName() {
      if (this.userProfile?.name) {
        return this.userProfile.name
      }
      if (this.userAddress) {
        return this.userAddress.substring(0, 8) + '...'
      }
      return 'Пользователь'
    },
    userAvatar() {
      // Используем геттер из store для надежного получения URL аватарки
      let avatarUrl = this.authStore.getUserAvatarUrl

      // Если геттер не вернул URL, пробуем достать из профиля напрямую
      if (!avatarUrl && this.userProfile) {
        const profile = this.userProfile
        avatarUrl = (profile as any).i || null

        // Если не нашли в 'i', проверяем альтернативные поля
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
      }

      if (avatarUrl && typeof avatarUrl === 'string' && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
        avatarUrl = avatarUrl.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      }

      // Если это не полный URL, преобразуем в полный
      if (avatarUrl && typeof avatarUrl === 'string' && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        avatarUrl = `https://pocketnet.app:8092/i/${avatarUrl}`
      }

      return avatarUrl
    },
    userBalance() {
      // Проверяем баланс в профиле
      const profile = this.userProfile
      const balance = profile?.balance

      // Если баланс не найден, проверяем альтернативные поля
      if (balance === null || balance === undefined) {
        // Баланс может быть в разных форматах или полях
        if (profile) {
          const profileAny = profile as any
          // Проверяем альтернативные поля для баланса
          const altBalance = profileAny.balance || profileAny.wallet || profileAny.amount || profileAny.bal || null
          if (altBalance !== null) {
            return altBalance
          }
        }
      }

      return balance ?? null
    },
    userInitial() {
      if (this.userProfile?.name) {
        return this.userProfile.name.charAt(0).toUpperCase()
      }
      if (this.userAddress) {
        return this.userAddress.charAt(0).toUpperCase()
      }
      return 'U'
    },
    isUserVerified(): boolean {
    const badges = (this.userProfile as any)?.badges
    if (!Array.isArray(badges)) return false
    if (
      badges.includes('verificated') ||
      badges.includes('verified')
    ) return true
    const flags = (this.userProfile as any)?.flags
    const real = (flags && (flags as any).real) ?? (this.userProfile as any)?.real
    return real === 1 || real === '1' || real === true || real === 'true'
  }
  },
  methods: {
    openSignInModal() {
      this.signInModalOpen = true
    },
    openRegisterModal() {
      this.registerModalOpen = true
    },
    handleSignInSuccess() {
      this.signInModalOpen = false
      // Данные пользователя загружаются автоматически в auth-store после успешного входа
    },
    handleSignInCancel() {
      this.signInModalOpen = false
    },
    handleOpenRegister() {
      this.registerModalOpen = true
      this.signInModalOpen = false
    },
    handleRegisterSuccess(mnemonic: string) {
      this.registerModalOpen = false
      // Показываем модалку с сид-фразой
      if (mnemonic) {
        this.mnemonic = mnemonic
        this.mnemonicModalOpen = true
      }
      // Данные пользователя загружаются автоматически в auth-store после успешной регистрации
    },
    handleRegisterValidation(data: { status: string; mnemonic: string }) {
      // Закрываем модалку регистрации
      this.registerModalOpen = false

      // Сохраняем мнемонику для показа позже
      if (data.mnemonic) {
        this.mnemonic = data.mnemonic
      }

      // Показываем модалку валидации
      this.validationStatus = data.status
      this.validationModalOpen = true

      // Начинаем проверку статуса регистрации
      this.startRegistrationStatusCheck()
    },
    async startRegistrationStatusCheck() {
      // Очищаем предыдущий interval, если есть
      if (this.registrationStatusCheckInterval) {
        clearInterval(this.registrationStatusCheckInterval)
        this.registrationStatusCheckInterval = null
      }

      // Функция проверки статуса
      const checkStatus = async () => {
        try {
          const { getRegistrationStatus, isRegistrationInProgress } = await import('@/blockchain/api/registration-status')
        const status = await getRegistrationStatus()

        this.validationStatus = status

        // Если регистрация завершена, закрываем модалку и показываем мнемонику
        if (!isRegistrationInProgress(status)) {
          if (this.registrationStatusCheckInterval) {
            clearInterval(this.registrationStatusCheckInterval)
            this.registrationStatusCheckInterval = null
          }
          this.validationModalOpen = false

          // Показываем модалку с мнемоникой
          if (this.mnemonic) {
            this.mnemonicModalOpen = true
          }

          // Загружаем данные пользователя
          await this.authStore.fetchUserState()
        }
      } catch (error) {
        console.error('Failed to check registration status:', error)
      }
    }

      // Проверяем статус регистрации каждые 30 секунд
      this.registrationStatusCheckInterval = setInterval(checkStatus, 30000)

      // Первая проверка сразу
      await checkStatus()
    },
    handleMnemonicModalClose() {
      this.mnemonicModalOpen = false
      this.mnemonic = ''
    },
    handleDontShowMnemonicAgain() {
      const address = this.authStore.getUserAddress
      if (address) {
        setDontShowMnemonic(address)
      }
    },
    handleRegisterCancel() {
      this.registerModalOpen = false
    },
    handleOpenSignIn() {
      this.signInModalOpen = true
      this.registerModalOpen = false
    },
    formatBalance(balance: number | null | undefined): string {
      // Используем хелпер для конвертации из минимальных единиц в PKOIN
      // Баланс приходит в минимальных единицах (аналог сатоши)
      return formatPkoin(balance, 2, false)
    },
    async handleMenuClick({ key }: { key: string }) {
      if (key === 'signout') {
        this.confirmSignOutOpen = true
      } else if (key === 'settings') {
        this.$router.push('/settings')
      } else if (key === 'switchAccount') {
        this.accountSwitcherOpen = true
      } else if (key.startsWith('/')) {
        this.$router.push(key)
      }
    },
    handleAccountSwitcherClose() {
      this.accountSwitcherOpen = false
    },
    handleConfirmSignOut() {
      this.confirmSignOutOpen = false
      this.handleSignOut()
    },
    handleCancelSignOut() {
      this.confirmSignOutOpen = false
    },
    handleValidationModalUpdate(value: boolean) {
      this.validationModalOpen = value
      // Если модалка закрыта вручную, останавливаем проверку статуса
      if (!value && this.registrationStatusCheckInterval) {
        clearInterval(this.registrationStatusCheckInterval)
        this.registrationStatusCheckInterval = null
      }
    },
    async handleSignOut() {
      try {
        // Выходим только из текущего аккаунта, а не из всех
        const currentAddress = this.authStore.getUserAddress
        if (currentAddress) {
          await this.authStore.removeAccount(currentAddress)
        } else {
          // Если адреса нет, используем обычный signOut
          await this.authStore.signOut()
        }
      } catch (error) {
        // Игнорируем ошибки при выходе
      }
    },
    // Проверяет статус регистрации при загрузке приложения
    async checkRegistrationStatusOnLoad() {
      if (!this.isAuthenticated) {
        return
      }

      try {
        const { getRegistrationStatus, isRegistrationInProgress } = await import('@/blockchain/api/registration-status')
        const status = await getRegistrationStatus()

        // Если регистрация в процессе, показываем модалку валидации
        if (isRegistrationInProgress(status)) {
          this.validationStatus = status
          this.validationModalOpen = true
          this.startRegistrationStatusCheck()
        }
      } catch (error) {
        console.error('Failed to check registration status on load:', error)
      }
    },
    // Проверяет и показывает модалку с сид-фразой, если нужно
    async checkAndShowMnemonic() {
      const address = this.authStore.getUserAddress
      if (!address || !this.isAuthenticated) {
        return
      }

      if (shouldShowMnemonic(address)) {
        // Загружаем мнемонику из хранилища
        const { loadEncryptedMnemonic } = await import('@/blockchain/storage')
        const result = loadEncryptedMnemonic(true) // Проверяем в localStorage

        if (result.success && result.data) {
          this.mnemonic = result.data
          // Показываем модалку с задержкой (как в старом приложении - 3 секунды)
          setTimeout(() => {
            this.mnemonicModalOpen = true
          }, 3000)
        }
      }
    },
  },
  async mounted() {
    this.dropdownOverlayClass =
      (this.$refs.dropdownZindexFixRef as any)?.$el?.className ?? ''

    // Пытаемся восстановить сессию при монтировании компонента
    // fetchUserState автоматически вызывается в restoreSession, поэтому дополнительный вызов не нужен
    await this.authStore.restoreSession()

    // Проверяем статус регистрации при загрузке
    await this.checkRegistrationStatusOnLoad()

    // Проверяем, нужно ли показать сид-фразу после загрузки
    this.checkAndShowMnemonic()
  },
  watch: {
    // Синхронизация состояния модалки авторизации с глобальным store
    'modalStore.authModal.isOpen'(isOpen: boolean) {
      if (isOpen) {
        if (this.modalStore.authModal.mode === 'login') {
          this.signInModalOpen = true
          this.registerModalOpen = false
        } else {
          this.registerModalOpen = true
          this.signInModalOpen = false
        }
      } else {
        this.signInModalOpen = false
        this.registerModalOpen = false
      }
    },
    // Синхронизация локального состояния с store (если закрыли вручную)
    signInModalOpen(isOpen: boolean) {
      if (!isOpen && this.modalStore.authModal.isOpen && this.modalStore.authModal.mode === 'login') {
        this.modalStore.closeAuthModal()
      }
    },
    registerModalOpen(isOpen: boolean) {
      if (!isOpen && this.modalStore.authModal.isOpen && this.modalStore.authModal.mode === 'register') {
        this.modalStore.closeAuthModal()
      }
    },

    // Загружаем полное состояние пользователя при изменении адреса
    userAddress: {
      handler: async function(newAddress, oldAddress) {
        if (newAddress && newAddress !== oldAddress && this.isAuthenticated) {
          // При изменении адреса всегда загружаем данные заново
          // Очищаем старые данные профиля, чтобы не показывать данные предыдущего аккаунта
          const profile = this.authStore.getUserProfile
          if (profile) {
            // Проверяем, что профиль соответствует новому адресу
            const profileAddress = (profile as any)?.address
            if (profileAddress && profileAddress !== newAddress) {
              // Если адрес не совпадает, принудительно загружаем данные
              // Очистка будет выполнена в switchAccount, но на всякий случай проверяем здесь
              await this.authStore.fetchUserState()
            } else if (!profileAddress) {
              // Если адреса нет в профиле, загружаем данные
              await this.authStore.fetchUserState()
            }
          } else {
            // Если профиля нет, загружаем данные
            await this.authStore.fetchUserState()
          }
        }
      },
      immediate: false
    }
  }
})
