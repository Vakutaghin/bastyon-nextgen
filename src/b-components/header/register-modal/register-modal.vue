<template>
  <Modal
    v-model:open="isOpen"
    :title="t('auth.registerTitle')"
    :width="500"
    :centered="true"
    :closable="!loading"
    :mask-closable="!loading"
    :keyboard="!loading"
    :destroy-on-close="true"
    @cancel="handleCancel"
  >
    <SC_RegisterForm>
      <SC_FormItem>
        <SC_FormLabel for="register-nickname"> {{ t('auth.nickname') }} </SC_FormLabel>
        <SC_InputWrapper>
          <input
            id="register-nickname"
            class="ant-input"
            :value="nickname"
            :placeholder="t('auth.nicknamePlaceholder')"
            :disabled="loading"
            maxlength="20"
            @input="onNicknameInput"
            @keyup.enter="handleRegister"
          />
        </SC_InputWrapper>
        <SC_FormHint>
          {{ t('auth.nicknameHint') }}
        </SC_FormHint>
      </SC_FormItem>

      <SC_FormItem>
        <SC_FormLabel for="register-email">
          {{ t('auth.email') }}
          <SC_FormLabelOptional>{{ t('auth.optional') }}</SC_FormLabelOptional>
        </SC_FormLabel>
        <SC_InputWrapper>
          <input
            id="register-email"
            :value="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
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
        {{ t('auth.alreadyRegistered') }}
        <SC_LinkButton :isDisabled="loading" @click="handleOpenSignIn">
          {{ t('auth.signIn') }}
        </SC_LinkButton>
      </SC_LinkToSignIn>
    </SC_RegisterForm>

    <template #footer>
      <SC_FooterActions>
        <!-- Во время регистрации «Отмена» остаётся активной — единственный явный
             способ прервать процесс (крестик/маска/Esc заблокированы). -->
        <Button type="default" :disabled="isCancelling" @click="handleCancel">
          {{ isCancelling ? t('auth.cancelling') : t('auth.cancel') }}
        </Button>
        <Button
          type="primary"
          :loading="loading"
          :disabled="!isFormValid || loading"
          @click="handleRegister"
        >
          {{ t('auth.register') }}
        </Button>
      </SC_FooterActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
  SC_FooterActions,
} from './styled'
import {
  savePendingRegistration,
  loadPendingRegistration,
  clearPendingRegistration,
} from './helpers/pending-registration-store'
import { sendRegistrationTransaction } from './send-registration-transaction'
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

const { t } = useI18n()
const authStore = useAuthStore()

const nickname = ref('')
const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
let nicknameTimer: ReturnType<typeof setTimeout> | null = null

// Управление отменой активной регистрации. Прерываем на границах шагов (сетевые
// вызовы не принимают внешний signal), затем откатываем аккаунт и pending-запись.
let abortController: AbortController | null = null
const isCancelling = ref(false)
// Маркер отмены, чтобы отличить её от реальной ошибки в общем catch.
const CANCELLED = Symbol('registration-cancelled')

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
      isCancelling.value = false
      abortController = null
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
    sendRegistrationTransaction(pending.nickname, authStore)
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

  // Защита от повторного запуска, пока регистрация уже идёт.
  if (loading.value) return

  const validationError = validateRegistrationNickname(nickname.value)
  if (validationError) {
    error.value = validationError
    return
  }

  loading.value = true
  error.value = null
  isCancelling.value = false
  abortController = new AbortController()

  // Отмена возможна только до «точки невозврата» (emit('validation')): сетевые
  // вызовы не принимают signal, поэтому прерываемся на границах шагов.
  const bailIfCancelled = (): void => {
    if (abortController?.signal.aborted) throw CANCELLED
  }

  try {
    debugLog('[REG] Step 1: checking name...')
    await checkNameAvailability(nickname.value)
    bailIfCancelled()

    debugLog('[REG] Step 2: generating keys...')
    const registrationResult = await authStore.register({
      generateNew: true,
      saveAfterRegistration: true,
    })

    if (!registrationResult?.address) {
      throw new Error(t('auth.errorCreateAccount'))
    }
    debugLog('[REG] Step 2: keys generated, address:', registrationResult.address)
    bailIfCancelled()

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
    bailIfCancelled()

    // step=2: free/balance отправлен в сервер, ждём подтверждения (UTXO).
    savePendingRegistration({
      nickname: nickname.value,
      address: registrationResult.address,
      step: 2,
      timestamp: Date.now(),
    })

    debugLog('[REG] Step 4: optimistic — showing validation modal')
    // Точка невозврата: аккаунт создан, дальше транзакция уходит в фон.
    emit('validation', {
      status: 'in_progress_transaction',
      mnemonic: registrationResult.mnemonic,
      nickname: nickname.value,
    })

    sendRegistrationTransaction(nickname.value, authStore)
  } catch (err) {
    // Отмена пользователем: откатываем созданный аккаунт и незавершённую
    // pending-регистрацию, не показываем ошибку.
    if (err === CANCELLED || isCancelling.value) {
      authStore.resetAuthOnRegistrationError()
      clearPendingRegistration()
      nickname.value = ''
      email.value = ''
      error.value = null
      emit('cancel')
      emit('update:open', false)
      return
    }
    console.error('[REG] ERROR:', err)
    error.value = err instanceof Error ? err.message : t('auth.errorRegistration')
    const pending = loadPendingRegistration()
    if (!pending || pending.step < 1) {
      authStore.resetAuthOnRegistrationError()
    }
  } finally {
    loading.value = false
    abortController = null
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
        const nameTakenError = new Error(t('auth.errorNameTaken'))
        ;(nameTakenError as Error & { isNameTaken?: boolean }).isNameTaken = true
        throw nameTakenError
      }
    }
  } catch (err) {
    if ((err as { isNameTaken?: boolean })?.isNameTaken) throw err
  }
}

function handleOpenSignIn(): void {
  // Во время регистрации переключение на вход заблокировано.
  if (loading.value) return
  emit('openSignIn')
  emit('update:open', false)
}

function handleCancel(): void {
  // Отмена во время активной регистрации: прерываем процесс и ждём, пока
  // handleRegister доведёт откат и закроет модалку.
  if (loading.value) {
    isCancelling.value = true
    abortController?.abort()
    return
  }
  emit('cancel')
  emit('update:open', false)
}
</script>
