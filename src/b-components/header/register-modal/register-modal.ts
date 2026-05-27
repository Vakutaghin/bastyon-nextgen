import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Input from '@/components/input/input.vue'
import Button from '@/components/button/button.vue'
import { useAuthStore } from '@/blockchain'
import type { Props } from './types'
import {
  SC_RegisterForm,
  SC_FormItem,
  SC_FormLabel,
  SC_FormLabelOptional,
  SC_InputWrapper,
  SC_FormHint,
  SC_ErrorMessage,
  SC_LinkToSignIn,
  SC_LinkButton,
} from './styled'
import {
  savePendingRegistration,
  loadPendingRegistration,
  clearPendingRegistration,
  markPendingRegistrationStep,
} from './helpers/pending-registration-store'
import { waitForUnspents } from './helpers/wait-for-unspents'
import {
  isFormNicknameValid,
  normalizeAndCapNickname,
  validateRegistrationNickname,
} from './helpers/nickname-validation'

export const registerModalOptions = defineComponent({
  name: 'RegisterModal',
  components: {
    Modal,
    /* eslint-disable vue/no-reserved-component-names */
    Input,
    Button,
    /* eslint-enable vue/no-reserved-component-names */
    SC_RegisterForm,
    SC_FormItem,
    SC_FormLabel,
    SC_FormLabelOptional,
    SC_InputWrapper,
    SC_FormHint,
    SC_ErrorMessage,
    SC_LinkToSignIn,
    SC_LinkButton,
  },
  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:open', 'success', 'validation', 'cancel', 'openSignIn'],
  setup(
    _p: Props,
    {
      emit,
    }: {
      emit: (event: 'update:open' | 'success' | 'cancel' | 'openSignIn', ...args: any[]) => void
    }
  ) {
    const authStore = useAuthStore()

    return {
      authStore,
      emit,
    }
  },
  data() {
    return {
      nickname: '',
      email: '',
      loading: false,
      error: null as string | null,
      nicknameTimer: null as ReturnType<typeof setTimeout> | null,
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
    isFormValid(): boolean {
      return isFormNicknameValid(this.nickname)
    },
  },
  watch: {
    open(newValue: boolean) {
      if (!newValue) {
        this.nickname = ''
        this.email = ''
        this.error = null
        this.loading = false
      } else {
        this.checkPendingRegistration()
      }
    },
  },
  methods: {
    onNicknameInput(eventOrValue: Event | string) {
      const value =
        typeof eventOrValue === 'string'
          ? eventOrValue
          : ((eventOrValue?.target as HTMLInputElement)?.value ?? '')

      this.nickname = value

      if (this.nicknameTimer) {
        clearTimeout(this.nicknameTimer)
      }
      this.nicknameTimer = setTimeout(() => {
        const normalized = normalizeAndCapNickname(this.nickname)
        if (normalized !== this.nickname) {
          this.nickname = normalized
        }
      }, 300)
    },

    onEmailInput(event: Event) {
      this.email = (event.target as HTMLInputElement).value
    },

    /**
     * Проверяет незавершённую регистрацию после перезагрузки.
     */
    async checkPendingRegistration() {
      const pending = loadPendingRegistration()
      if (!pending) return

      const address = this.authStore.getUserAddress
      const keyPair = this.authStore.getKeyPair

      if (!address || !keyPair || address !== pending.address) {
        clearPendingRegistration()
        return
      }

      // step >= 2: free/balance уже запрошен, транзакция может быть в процессе
      // Запускаем фоновую отправку (если tx ещё не отправлена)
      if (pending.step >= 2 && pending.step < 3) {
        this.sendTransactionInBackground(pending.nickname)
      }
    },

    /**
     * Основной обработчик регистрации.
     *
     * ОПТИМИСТИЧНЫЙ ПОДХОД (как в оригинале):
     * 1. Проверить имя
     * 2. Сгенерировать ключи
     * 3. Запросить free/balance (капча)
     * 4. СРАЗУ показать "в процессе" — не ждём unspents!
     * 5. В фоне: дождаться unspents → собрать tx → отправить
     */
    async handleRegister() {
      console.log('[REG] === handleRegister START ===', this.nickname)

      const validationError = validateRegistrationNickname(this.nickname)
      if (validationError) {
        this.error = validationError
        return
      }

      this.loading = true
      this.error = null

      try {
        // Шаг 1: Проверяем имя
        console.log('[REG] Step 1: checking name...')
        await this.checkNameAvailability(this.nickname)

        // Шаг 2: Генерируем ключи
        console.log('[REG] Step 2: generating keys...')
        const registrationResult = await this.authStore.register({
          generateNew: true,
          saveAfterRegistration: true,
        })

        if (!registrationResult?.address) {
          throw new Error('Не удалось создать аккаунт')
        }
        console.log('[REG] Step 2: keys generated, address:', registrationResult.address)

        savePendingRegistration({
          nickname: this.nickname,
          address: registrationResult.address,
          step: 1,
          timestamp: Date.now(),
        })

        // Шаг 3: Запрашиваем free/balance (включая капчу)
        console.log('[REG] Step 3: requesting free balance...')
        const { requestUnspents } = await import('@/blockchain/api/free-balance-api')
        await requestUnspents(registrationResult.address, { reason: 'registration' })
        console.log('[REG] Step 3: free/balance requested!')

        // Помечаем step=2: free/balance запрошен
        savePendingRegistration({
          nickname: this.nickname,
          address: registrationResult.address,
          step: 2,
          timestamp: Date.now(),
        })

        // Шаг 4: ОПТИМИСТИЧНО показываем "регистрация в процессе"
        // НЕ ЖДЁМ unspents — как в оригинале!
        console.log('[REG] Step 4: optimistic — showing validation modal')
        this.$emit('validation', {
          status: 'in_progress_transaction',
          mnemonic: registrationResult.mnemonic,
          nickname: this.nickname,
        })

        // Шаг 5: В ФОНЕ ждём unspents → собираем tx → отправляем
        this.sendTransactionInBackground(this.nickname)
      } catch (err) {
        console.error('[REG] ERROR:', err)
        this.error = err instanceof Error ? err.message : 'Произошла ошибка при регистрации'
        const pending = loadPendingRegistration()
        if (!pending || pending.step < 1) {
          this.authStore.resetAuthOnRegistrationError()
        }
      } finally {
        this.loading = false
      }
    },

    /**
     * Фоновая задача: ждёт unspents → строит и отправляет транзакцию.
     * Работает после оптимистичного emit('validation').
     * Пользователь уже видит "часики" и может закрыть модалку.
     */
    async sendTransactionInBackground(nickname: string) {
      try {
        const { serializeUserInfo, exportUserInfo } =
          await import('@/blockchain/core/actions/user-info-action')
        const { getUnspents, selectBestUnspents, filterAvailableUnspents } =
          await import('@/blockchain/core/transactions/unspents-manager')
        const { buildTransaction } =
          await import('@/blockchain/core/transactions/transaction-builder')
        const { sendTransactionWithMessage } =
          await import('@/blockchain/core/transactions/transaction-sender')
        const { DEFAULT_TX_FEE } = await import('@/blockchain/constants/transactions')
        const { deriveMessengerKeys } = await import('@/blockchain/core/keys/key-generator')
        const { getProxyWithWalletCached } = await import('@/blockchain/api/proxy-with-wallet')

        const address = this.authStore.getUserAddress
        const keyPair = this.authStore.getKeyPair

        if (!address || !keyPair) {
          console.error('[REG-BG] No keys/address')
          return
        }

        // cryptoKeys
        const cryptoKeys = deriveMessengerKeys(keyPair.privateKey)
        const publicKeys = cryptoKeys.map((k) => k.public)

        const userInfoData = {
          name: nickname,
          about: '',
          site: '',
          language: 'ru',
          image: '',
          addresses: [],
          ref: '',
          keys: publicKeys,
        }

        const serialized = serializeUserInfo(userInfoData)
        const userInfoExport = exportUserInfo(userInfoData, false)

        // Пробуем получить unspents — возможно, уже пришли
        let unspents = await getUnspents(address, 0, 9999999)
        unspents = filterAvailableUnspents(unspents, false)
        console.log('[REG-BG] Initial unspents:', unspents.length)

        // Если нет — ждём с polling
        if (unspents.length === 0) {
          const proxyServer = await getProxyWithWalletCached()
          unspents = await waitForUnspents({
            address,
            getUnspents,
            filterAvailableUnspents,
            proxyServer: proxyServer || undefined,
          })
          console.log('[REG-BG] Got unspents after waiting:', unspents.length)
        }

        const selectedUnspents = selectBestUnspents(unspents, 0)
        if (selectedUnspents.length === 0) {
          console.error('[REG-BG] No usable unspents after waiting')
          return
        }

        // Строим и отправляем транзакцию
        console.log('[REG-BG] Building transaction...')
        const builtTx = await buildTransaction({
          unspents: selectedUnspents,
          fromAddress: address,
          keyPair,
          serializedData: serialized,
          operationType: 'userInfo',
          fee: DEFAULT_TX_FEE,
          timeDifference: 0,
        })

        console.log('[REG-BG] Sending transaction...')
        const txid = await sendTransactionWithMessage({
          hex: builtTx.hex,
          messageData: userInfoExport,
          operationType: 'userInfo',
        })

        console.log('[REG-BG] Transaction sent! txid:', txid)

        // Помечаем step=3: транзакция отправлена
        markPendingRegistrationStep(3)

        // Мессенджер
        this.authStore.resetMessenger(true).catch(() => {})
      } catch (err) {
        console.error('[REG-BG] Background transaction error:', err)
        // Не показываем ошибку пользователю — часики уже крутятся,
        // при следующей перезагрузке checkPendingRegistration попробует снова
      }
    },

    async checkNameAvailability(name: string) {
      const { getByPRCWithAuth } = await import('@/helpers/api/request')

      try {
        const response = (await getByPRCWithAuth({
          method: 'getuseraddress',
          parameters: [name],
          options: { auth: false },
        })) as any[] | null

        if (response && Array.isArray(response) && response.length > 0 && response[0]?.address) {
          const existingAddress = response[0].address
          if (existingAddress !== this.authStore.getUserAddress) {
            throw new Error('Это имя уже занято. Пожалуйста, выберите другое.')
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('уже занято')) {
          throw error
        }
      }
    },

    handleOpenSignIn() {
      this.$emit('openSignIn')
      this.$emit('update:open', false)
    },

    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:open', false)
    },
  },
})
