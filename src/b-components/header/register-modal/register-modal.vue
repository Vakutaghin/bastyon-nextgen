<template>
  <Modal
    v-model:open="isOpen"
    title="Регистрация"
    :width="500"
    :centered="true"
    :closable="true"
    :mask-closable="true"
    :destroy-on-close="true"
    @cancel="handleCancel"
  >
    <SC_RegisterForm>
      <SC_FormItem>
        <SC_FormLabel for="register-nickname"> Псевдоним </SC_FormLabel>
        <SC_InputWrapper>
          <input
            id="register-nickname"
            class="ant-input"
            :value="nickname"
            placeholder="Введите псевдоним"
            :disabled="loading"
            maxlength="20"
            @input="onNicknameInput"
            @keyup.enter="handleRegister"
          />
        </SC_InputWrapper>
        <SC_FormHint>
          Максимум 20 символов. Только латинские буквы, цифры и нижнее подчеркивание. Русские буквы
          автоматически транслитерируются.
        </SC_FormHint>
      </SC_FormItem>

      <SC_FormItem>
        <SC_FormLabel for="register-email">
          Email
          <SC_FormLabelOptional>(необязательно)</SC_FormLabelOptional>
        </SC_FormLabel>
        <SC_InputWrapper>
          <input
            id="register-email"
            :value="email"
            type="email"
            placeholder="Введите email"
            :disabled="loading"
            @input="onEmailInput"
            @keyup.enter="handleRegister"
          />
        </SC_InputWrapper>
      </SC_FormItem>

      <SC_ErrorMessage v-if="error">
        {{ error }}
      </SC_ErrorMessage>

      <SC_LinkToSignIn>
        Уже зарегистрированы?
        <SC_LinkButton @click="handleOpenSignIn"> Войти </SC_LinkButton>
      </SC_LinkToSignIn>
    </SC_RegisterForm>

    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <Button type="default" :disabled="loading" @click="handleCancel"> Отмена </Button>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!isFormValid || loading"
          @click="handleRegister"
        >
          Зарегистрироваться
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { debugLog } from '@/helpers/common/debug-log'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { useAuthStore } from '@/blockchain'
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

interface ValidationPayload {
  status: 'in_progress_transaction'
  mnemonic: string | undefined
  nickname: string
}

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false })

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
  validation: [payload: ValidationPayload]
  cancel: []
  openSignIn: []
}>()

const authStore = useAuthStore()

const nickname = ref('')
const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
let nicknameTimer: ReturnType<typeof setTimeout> | null = null

const isOpen = computed<boolean>({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

const isFormValid = computed<boolean>(() => isFormNicknameValid(nickname.value))

watch(
  () => props.open,
  (newValue) => {
    if (!newValue) {
      nickname.value = ''
      email.value = ''
      error.value = null
      loading.value = false
      // При закрытии модалки гасим debounce-таймер — иначе он сработает после
      // unmount и попытается записать в `nickname.value` уже мёртвой ref.
      if (nicknameTimer) {
        clearTimeout(nicknameTimer)
        nicknameTimer = null
      }
    } else {
      checkPendingRegistration()
    }
  }
)

// Страховка от ранней размонтировки (роутинг увёз нас в момент, когда модалка
// открыта и timer заряжен): cleanup перед unmount гарантированно снимет setTimeout.
onBeforeUnmount(() => {
  if (nicknameTimer) {
    clearTimeout(nicknameTimer)
    nicknameTimer = null
  }
})

function onNicknameInput(eventOrValue: Event | string): void {
  const value =
    typeof eventOrValue === 'string'
      ? eventOrValue
      : ((eventOrValue?.target as HTMLInputElement | null)?.value ?? '')

  nickname.value = value

  // Дебаунс нормализации, чтобы пользователю не дёргало курсор при каждом
  // вводе — задержка позволяет дописать слово целиком.
  if (nicknameTimer) clearTimeout(nicknameTimer)
  nicknameTimer = setTimeout(() => {
    const normalized = normalizeAndCapNickname(nickname.value)
    if (normalized !== nickname.value) nickname.value = normalized
  }, 300)
}

function onEmailInput(event: Event): void {
  email.value = (event.target as HTMLInputElement).value
}

/** Проверяет незавершённую регистрацию после перезагрузки страницы. */
async function checkPendingRegistration(): Promise<void> {
  const pending = loadPendingRegistration()
  if (!pending) return

  const address = authStore.getUserAddress
  const keyPair = authStore.getKeyPair

  if (!address || !keyPair || address !== pending.address) {
    clearPendingRegistration()
    return
  }

  // step >= 2 — free/balance уже запрошен, осталось отправить транзакцию.
  if (pending.step >= 2 && pending.step < 3) {
    sendTransactionInBackground(pending.nickname)
  }
}

/**
 * Основной обработчик регистрации.
 *
 * Оптимистичный подход (как в оригинальном клиенте):
 * 1. Проверить имя.
 * 2. Сгенерировать ключи.
 * 3. Запросить free/balance (с капчей).
 * 4. СРАЗУ показать «в процессе» — не ждём unspents.
 * 5. В фоне: дождаться unspents → собрать tx → отправить.
 */
async function handleRegister(): Promise<void> {
  debugLog('[REG] === handleRegister START ===', nickname.value)

  const validationError = validateRegistrationNickname(nickname.value)
  if (validationError) {
    error.value = validationError
    return
  }

  loading.value = true
  error.value = null

  try {
    debugLog('[REG] Step 1: checking name...')
    await checkNameAvailability(nickname.value)

    debugLog('[REG] Step 2: generating keys...')
    const registrationResult = await authStore.register({
      generateNew: true,
      saveAfterRegistration: true,
    })

    if (!registrationResult?.address) {
      throw new Error('Не удалось создать аккаунт')
    }
    debugLog('[REG] Step 2: keys generated, address:', registrationResult.address)

    savePendingRegistration({
      nickname: nickname.value,
      address: registrationResult.address,
      step: 1,
      timestamp: Date.now(),
    })

    debugLog('[REG] Step 3: requesting free balance...')
    const { requestUnspents } = await import('@/blockchain/api/free-balance-api')
    await requestUnspents(registrationResult.address, { reason: 'registration' })
    debugLog('[REG] Step 3: free/balance requested!')

    // step=2: free/balance отправлен в сервер, ждём подтверждения (UTXO).
    savePendingRegistration({
      nickname: nickname.value,
      address: registrationResult.address,
      step: 2,
      timestamp: Date.now(),
    })

    debugLog('[REG] Step 4: optimistic — showing validation modal')
    emit('validation', {
      status: 'in_progress_transaction',
      mnemonic: registrationResult.mnemonic,
      nickname: nickname.value,
    })

    sendTransactionInBackground(nickname.value)
  } catch (err) {
    console.error('[REG] ERROR:', err)
    error.value = err instanceof Error ? err.message : 'Произошла ошибка при регистрации'
    const pending = loadPendingRegistration()
    if (!pending || pending.step < 1) {
      authStore.resetAuthOnRegistrationError()
    }
  } finally {
    loading.value = false
  }
}

/**
 * Фоновая задача: ждёт unspents → строит и отправляет транзакцию.
 * Срабатывает после оптимистичного `emit('validation')`. Пользователь уже
 * видит «часики» и может закрыть модалку.
 */
async function sendTransactionInBackground(nickname: string): Promise<void> {
  try {
    const { serializeUserInfo, exportUserInfo } =
      await import('@/blockchain/core/actions/user-info-action')
    const { getUnspents, selectBestUnspents, filterAvailableUnspents } =
      await import('@/blockchain/core/transactions/unspents-manager')
    const { buildTransaction } = await import('@/blockchain/core/transactions/transaction-builder')
    const { sendTransactionWithMessage } =
      await import('@/blockchain/core/transactions/transaction-sender')
    const { DEFAULT_TX_FEE } = await import('@/blockchain/constants/transactions')
    const { deriveMessengerKeys } = await import('@/blockchain/core/keys/key-generator')
    const { getProxyWithWalletCached } = await import('@/blockchain/api/proxy-with-wallet')

    const address = authStore.getUserAddress
    const keyPair = authStore.getKeyPair

    if (!address || !keyPair) {
      console.error('[REG-BG] No keys/address')
      return
    }

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

    // Пробуем получить unspents — возможно, уже пришли.
    let unspents = await getUnspents(address, 0, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    debugLog('[REG-BG] Initial unspents:', unspents.length)

    if (unspents.length === 0) {
      const proxyServer = await getProxyWithWalletCached()
      unspents = await waitForUnspents({
        address,
        getUnspents,
        filterAvailableUnspents,
        proxyServer: proxyServer || undefined,
      })
      debugLog('[REG-BG] Got unspents after waiting:', unspents.length)
    }

    const selectedUnspents = selectBestUnspents(unspents, 0)
    if (selectedUnspents.length === 0) {
      console.error('[REG-BG] No usable unspents after waiting')
      return
    }

    debugLog('[REG-BG] Building transaction...')
    const builtTx = await buildTransaction({
      unspents: selectedUnspents,
      fromAddress: address,
      keyPair,
      serializedData: serialized,
      operationType: 'userInfo',
      fee: DEFAULT_TX_FEE,
      timeDifference: 0,
    })

    debugLog('[REG-BG] Sending transaction...')
    const txid = await sendTransactionWithMessage({
      hex: builtTx.hex,
      messageData: userInfoExport,
      operationType: 'userInfo',
    })

    debugLog('[REG-BG] Transaction sent! txid:', txid)

    markPendingRegistrationStep(3)
    authStore.resetMessenger(true).catch(() => {})
  } catch (err) {
    console.error('[REG-BG] Background transaction error:', err)
    // Ошибку не показываем — «часики» уже крутятся в overlay'е, при
    // следующей перезагрузке `checkPendingRegistration` попробует снова.
  }
}

async function checkNameAvailability(name: string): Promise<void> {
  const { getByPRCWithAuth } = await import('@/helpers/api/request')

  try {
    const response = (await getByPRCWithAuth({
      method: 'getuseraddress',
      parameters: [name],
      options: { auth: false },
    })) as { address?: string }[] | null

    if (Array.isArray(response) && response.length > 0 && response[0]?.address) {
      const existingAddress = response[0].address
      if (existingAddress !== authStore.getUserAddress) {
        throw new Error('Это имя уже занято. Пожалуйста, выберите другое.')
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('уже занято')) throw err
  }
}

function handleOpenSignIn(): void {
  emit('openSignIn')
  emit('update:open', false)
}

function handleCancel(): void {
  emit('cancel')
  emit('update:open', false)
}
</script>
