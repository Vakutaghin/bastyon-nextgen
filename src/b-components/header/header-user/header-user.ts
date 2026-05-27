import { defineComponent } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
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

export const headerUserOptions = defineComponent({
  name: 'HeaderUser',
  components: {
    Dropdown,
    /* eslint-disable vue/no-reserved-component-names */
    Menu,
    Button,
    /* eslint-enable vue/no-reserved-component-names */
    Avatar,
    Skeleton,
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
    SC_AuthSkeleton,
    SC_SkeletonLines,
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
      signInModalOpen: false,
      registerModalOpen: false,
      mnemonicModalOpen: false,
      mnemonic: '',
      privateKeyHex: '',
      accountSwitcherOpen: false,
      confirmSignOutOpen: false,
      validationModalOpen: false,
      validationStatus: null as string | null,
      registrationPending: false,
      pendingNickname: null as string | null,
      registrationWatcher: null as RegistrationStatusWatcher | null,
      dropdownOverlayClass: '',
    }
  },
  computed: {
    menuItems() {
      return [
        { key: this.profileLink, label: 'Профиль' },
        { key: '/wallets', label: 'Кошельки' },
        { key: '/limits', label: 'Лимиты' },
        { key: '/my-videos', label: 'Мои видео' },
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
    isAuthRestoring() {
      return this.authStore.isAuthRestoring
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
      // Показываем сохранённый ник пока профиль не подтверждён в блокчейне
      if (this.pendingNickname) {
        return this.pendingNickname
      }
      // Кэш ника из прошлой сессии — чтобы не мелькал обрезанный адрес
      // пока fetchUserState поднимает свежий профиль.
      const cached = this.authStore.getCachedAccountName
      if (cached) {
        return cached
      }
      if (this.userAddress) {
        return this.userAddress.substring(0, 8) + '...'
      }
      return 'Пользователь'
    },
    userAvatar() {
      // Сначала пытаемся взять из стора, иначе — fallback на поля профиля.
      // resolveImageUrl внутри extractAvatarFromProfile нормализует домен и достраивает URL от хэша.
      const fromStore = this.authStore.getUserAvatarUrl
      if (fromStore) return fromStore
      return extractAvatarFromProfile(this.userProfile) ?? null
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
          const altBalance =
            profileAny.balance || profileAny.wallet || profileAny.amount || profileAny.bal || null
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
      if (badges.includes('verificated') || badges.includes('verified')) return true
      const flags = (this.userProfile as any)?.flags
      const real = (flags && (flags as any).real) ?? (this.userProfile as any)?.real
      return real === 1 || real === '1' || real === true || real === 'true'
    },
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
    handleRegisterValidation(data: { status: string; mnemonic: string; nickname?: string }) {
      // Закрываем модалку регистрации
      this.registerModalOpen = false

      // Сохраняем мнемонику для показа позже
      if (data.mnemonic) {
        this.mnemonic = data.mnemonic
      }

      // Сохраняем ник для показа до подтверждения
      if (data.nickname) {
        this.pendingNickname = data.nickname
        try {
          localStorage.setItem('pending_nickname', data.nickname)
        } catch {
          /* ignore */
        }
      }

      // Показываем модалку валидации и помечаем pending
      this.validationStatus = data.status
      this.registrationPending = true
      this.validationModalOpen = true

      // Начинаем проверку статуса регистрации
      this.startRegistrationStatusCheck()
    },
    async startRegistrationStatusCheck() {
      this.registrationWatcher?.stop()
      this.registrationWatcher = createRegistrationStatusWatcher({
        onStatusUpdate: (status) => {
          console.log('[header-user] Status check:', status)
          this.validationStatus = status
        },
        onComplete: async (status) => {
          console.log('[header-user] Registration complete:', status)
          // Снимаем pending-статус
          this.registrationPending = false
          this.pendingNickname = null
          try {
            localStorage.removeItem('pending_nickname')
            localStorage.removeItem('pending_registration')
          } catch {
            /* ignore */
          }
          this.validationModalOpen = false
          // Показываем модалку с мнемоникой
          if (this.mnemonic) this.mnemonicModalOpen = true
          // Подтягиваем свежий профиль с именем
          await this.authStore.fetchUserState()
        },
        onError: (err) => {
          console.error('Failed to check registration status:', err)
        },
      })
      await this.registrationWatcher.start()
    },
    handleMnemonicModalClose() {
      this.mnemonicModalOpen = false
      this.mnemonic = ''
      this.privateKeyHex = ''
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
    /**
     * Повторяет фоновую отправку транзакции регистрации.
     * Вызывается при перезагрузке, если step=2 (free/balance отправлен, tx нет).
     */
    async retryBackgroundTransaction(nickname: string) {
      const outcome = await retryRegistrationBackgroundTx({
        address: this.authStore.getUserAddress,
        keyPair: this.authStore.getKeyPair,
        nickname,
      })
      if (outcome === 'fatal') {
        // Хелпер уже очистил localStorage; снимаем pending в UI.
        this.registrationPending = false
        this.pendingNickname = null
      }
    },

    onAvatarClick() {
      if (this.registrationPending) {
        this.validationModalOpen = true
      }
    },
    handleValidationModalUpdate(value: boolean) {
      this.validationModalOpen = value
      // НЕ останавливаем polling при закрытии модалки —
      // проверка должна продолжаться пока registrationPending
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
      // Всегда перенаправляем на главную после выхода
      this.$router.push('/')
    },
    // Проверяет статус регистрации при загрузке приложения
    async checkRegistrationStatusOnLoad() {
      if (!this.isAuthenticated) {
        return
      }

      // Восстанавливаем pending nickname из localStorage
      try {
        const savedNickname = localStorage.getItem('pending_nickname')
        if (savedNickname) {
          this.pendingNickname = savedNickname
          console.log('[header-user] Restored pending nickname:', savedNickname)
        }
      } catch {
        /* ignore */
      }

      // Быстрая проверка: если есть pending_nickname, сразу ставим pending
      // (до async RPC-вызова, чтобы часики появились мгновенно)
      if (this.pendingNickname) {
        this.registrationPending = true
      }

      try {
        const { getRegistrationStatus, isRegistrationInProgress } =
          await import('@/blockchain/api/registration-status')
        const status = await getRegistrationStatus()
        console.log('[header-user] Registration status on load:', status)

        if (isRegistrationInProgress(status)) {
          this.validationStatus = status
          this.registrationPending = true
          this.startRegistrationStatusCheck()

          // Если транзакция ещё не отправлена (step=2), запускаем фоновую отправку
          try {
            const pendingRaw = localStorage.getItem('pending_registration')
            if (pendingRaw) {
              const pending = JSON.parse(pendingRaw)
              if (pending && pending.step >= 2 && pending.step < 3 && pending.nickname) {
                console.log('[header-user] Resuming background transaction for:', pending.nickname)
                // Динамически импортируем и запускаем фоновую отправку
                this.retryBackgroundTransaction(pending.nickname)
              }
            }
          } catch {
            /* ignore */
          }
        } else {
          // Регистрация завершена — очищаем pending
          console.log('[header-user] Registration complete, clearing pending')
          this.registrationPending = false
          this.pendingNickname = null
          try {
            localStorage.removeItem('pending_nickname')
            localStorage.removeItem('pending_registration')
          } catch {
            /* ignore */
          }
          // Обновляем профиль чтобы подтянуть имя
          this.authStore.fetchUserState().catch(() => {})
        }
      } catch (error) {
        console.error('Failed to check registration status on load:', error)
        // При ошибке: если есть pending_nickname — оставляем pending
        // (лучше показать часики, чем потерять статус)
        if (this.pendingNickname) {
          this.registrationPending = true
          this.startRegistrationStatusCheck()
        }
      }
    },
    // Проверяет и показывает модалку с сид-фразой, если нужно
    async checkAndShowMnemonic() {
      const address = this.authStore.getUserAddress
      if (!address || !this.isAuthenticated) return
      if (!shouldShowMnemonic(address)) return

      const result = await loadPendingMnemonic()
      if (!result) return

      this.mnemonic = result.mnemonic
      this.privateKeyHex = result.privateKeyHex
      setTimeout(() => {
        this.mnemonicModalOpen = true
      }, 3000)
    },
  },
  async mounted() {
    this.dropdownOverlayClass = (this.$refs.dropdownZindexFixRef as any)?.$el?.className ?? ''

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
      if (
        !isOpen &&
        this.modalStore.authModal.isOpen &&
        this.modalStore.authModal.mode === 'login'
      ) {
        this.modalStore.closeAuthModal()
      }
    },
    registerModalOpen(isOpen: boolean) {
      if (
        !isOpen &&
        this.modalStore.authModal.isOpen &&
        this.modalStore.authModal.mode === 'register'
      ) {
        this.modalStore.closeAuthModal()
      }
    },

    // Загружаем полное состояние пользователя при изменении адреса
    userAddress: {
      handler: async function (newAddress, oldAddress) {
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
      immediate: false,
    },
  },
})
