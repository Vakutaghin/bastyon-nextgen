import { defineComponent } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Input from '@/components/input/input.vue'
import Button from '@/components/button/button.vue'
import { useAuthStore } from '@/blockchain'
import { normalizeNickname, validateNickname } from '@/helpers/common/transliterate'
import { setNeedShowMnemonic } from '@/helpers/common/mnemonic-storage'
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

export const registerModalOptions = defineComponent({
  name: 'RegisterModal',
  components: {
    Modal,
    Input,
    Button,
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
    { emit }: { emit: (event: 'update:open' | 'success' | 'cancel' | 'openSignIn', ...args: any[]) => void },
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
      return !!this.nickname.trim() && validateNickname(this.nickname)
    },
  },
  watch: {
    open(newValue: boolean) {
      if (!newValue) {
        this.nickname = ''
        this.email = ''
        this.error = null
        this.loading = false
      }
    },
    nickname(newValue: string) {
      // Автоматически нормализуем псевдоним при вводе
      const normalized = normalizeNickname(newValue)
      if (normalized !== newValue) {
        this.nickname = normalized
      }
    },
  },
  methods: {
    // Обработчик регистрации
    async handleRegister() {
      // Валидация
      if (!this.nickname.trim()) {
        this.error = 'Введите псевдоним'
        return
      }

      if (!validateNickname(this.nickname)) {
        this.error = 'Псевдоним может содержать только латинские буквы, цифры и нижнее подчеркивание'
        return
      }

      this.loading = true
      this.error = null

      try {
        // Сначала регистрируем аккаунт (генерируем ключи)
        const registrationResult = await this.authStore.register({
          generateNew: true,
          saveAfterRegistration: true,
        })

        if (!registrationResult || !registrationResult.address) {
          throw new Error('Не удалось создать аккаунт')
        }

        // Убеждаемся, что ключи сохранены в store перед вызовом registerOnServer
        // Это важно для подписи запросов капчи
        if (!this.authStore.getKeyPair || !this.authStore.getUserAddress) {
          throw new Error('Ключи не были сохранены после регистрации')
        }

        // Затем регистрируем пользователя на сервере с псевдонимом и email
        await this.registerOnServer(this.nickname, this.email || undefined)

        // После успешной регистрации показываем модалку валидации
        // Транзакция отправлена в блокчейн, нужно дождаться подтверждения
        this.$emit('validation', {
          status: 'in_progress_transaction',
          mnemonic: registrationResult.mnemonic,
        })

        // Не закрываем модалку регистрации сразу - она закроется при показе модалки валидации
        // this.$emit('update:open', false)
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Произошла ошибка при регистрации'
        // При ошибке регистрации сбрасываем статус авторизации
        // Это важно, так как register() мог установить isAuthenticated = true
        // до того, как произошла ошибка в registerOnServer()
        this.authStore.resetAuthOnRegistrationError()
      } finally {
        this.loading = false
      }
    },

    // Регистрация пользователя на сервере через транзакцию
    async registerOnServer(nickname: string, _email?: string) {
      const { serializeUserInfo, exportUserInfo } = await import('@/blockchain/core/actions/user-info-action')
      const {
        getUnspents,
        selectBestUnspents,
        filterAvailableUnspents,
      } = await import('@/blockchain/core/transactions/unspents-manager')

      const { buildTransaction } = await import('@/blockchain/core/transactions/transaction-builder')
      const { sendTransactionWithMessage } = await import('@/blockchain/core/transactions/transaction-sender')
      const { DEFAULT_TX_FEE } = await import('@/blockchain/constants/transactions')

      const address = this.authStore.getUserAddress
      const keyPair = this.authStore.getKeyPair

      if (!address || !keyPair) {
        throw new Error('Адрес или ключи не найдены. Пожалуйста, убедитесь, что регистрация завершена.')
      }

      // Убеждаемся, что ключи доступны для подписи запросов
      // Это важно для запросов капчи, которые требуют авторизации
      console.debug('Registering on server', {
        hasAddress: !!address,
        hasKeyPair: !!keyPair,
        hasEcPair: !!keyPair?.ecPair,
        address: address,
      })

      // Получаем публичные ключи для userInfo
      // В старом приложении используются cryptoKeys() - 12 публичных ключей
      // Пока используем только публичный ключ из keyPair
      const publicKeys = [keyPair.publicKey.toString('hex')]

      // Создаем объект userInfo
      const userInfoData = {
        name: nickname,
        about: '',
        site: '',
        language: 'ru', // Можно получить из настроек
        image: '',
        addresses: [],
        ref: '',
        keys: publicKeys,
      }

      // Сериализуем userInfo (как в старом приложении)
      const serialized = serializeUserInfo(userInfoData)

      // Экспортируем userInfo в формат для транзакции
      const userInfoExport = exportUserInfo(userInfoData, false)

      // Шаг 1: Получаем unspents для адреса
      let unspents = await getUnspents(address, 1, 9999999)

      // Фильтруем доступные unspents
      unspents = filterAvailableUnspents(unspents, false) // Разрешаем неподтвержденные для userInfo

      // Шаг 1.5: Если нет unspents, запрашиваем бесплатные для регистрации
      if (unspents.length === 0) {
        try {
          const { requestUnspents } = await import('@/blockchain/api/free-balance-api')

          // Запрашиваем бесплатные unspents для регистрации
          // Включает решение капчи, если требуется
          await requestUnspents(
            address,
            {
              reason: 'registration',
            },
            // Callback для показа капчи пользователю (если требуется)
            // Пока оставляем undefined - капча будет решаться автоматически, если возможно
            undefined
          )

          // Ждем немного, чтобы unspents появились на сервере
          // В оригинальном приложении используется willChangeUnspentsCallback
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Проверяем unspents снова
          unspents = await getUnspents(address, 1, 9999999)
          unspents = filterAvailableUnspents(unspents, false)
        } catch (error) {
          // Если запрос не удался, продолжаем - возможно, unspents появятся позже
          // или пользователь пополнит баланс вручную
          console.warn('Не удалось запросить бесплатные unspents для регистрации:', error)

          // Если это не ошибка капчи, выбрасываем ошибку
          if (!(error instanceof Error && error.message.includes('captcha'))) {
            throw new Error('Не удалось получить средства для регистрации. Пожалуйста, попробуйте позже или пополните баланс вручную.')
          }
        }
      }

      // Шаг 2: Выбираем лучшие unspents для транзакции
      // Для userInfo нужна минимальная сумма (только для комиссии)
      const selectedUnspents = unspents.length > 0
        ? selectBestUnspents(unspents, 0)
        : []

      // Если после всех попыток unspents все еще нет, выбрасываем ошибку
      if (selectedUnspents.length === 0) {
        throw new Error('Для регистрации требуется минимальный баланс для оплаты комиссии транзакции. Пожалуйста, попробуйте позже или пополните баланс.')
      }

      // Шаг 3: Собираем транзакцию
      const builtTx = await buildTransaction({
        unspents: selectedUnspents,
        fromAddress: address,
        keyPair,
        serializedData: serialized,
        operationType: 'userInfo',
        fee: DEFAULT_TX_FEE,
        timeDifference: 0, // Можно получить с ноды, но для простоты используем 0
      })

      // Шаг 4: Отправляем транзакцию через sendrawtransactionwithmessage
      const txid = await sendTransactionWithMessage({
        hex: builtTx.hex,
        messageData: userInfoExport,
        operationType: 'userInfo',
      })

      // Возвращаем txid для возможного логирования
      return { txid, builtTx }
    },

    // Обработчик открытия модалки входа
    handleOpenSignIn() {
      this.$emit('openSignIn')
      this.$emit('update:open', false)
    },

    // Обработчик отмены
    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:open', false)
    },
  },
})
