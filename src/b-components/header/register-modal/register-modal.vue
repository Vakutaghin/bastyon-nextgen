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
        <SC_FormHintError v-if="nameTaken" role="alert">
          {{ t('auth.errorNameTaken') }}
        </SC_FormHintError>
        <SC_FormHint v-else>
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
  SC_FormHintError,
  SC_ErrorMessage,
  SC_LinkToSignIn,
  SC_LinkButton,
  SC_FooterActions,
} from './styled'
import {
  savePendingRegistration,
  loadPendingRegistration,
} from './helpers/pending-registration-store'
import { registrationRejectionReason } from './helpers/rejection-reason'
import { setNeedShowMnemonic } from '@/helpers/common/mnemonic-storage'
import type { UserAddressData } from '@/types/rpc-responses/get-user-address'
import {
  isFormNicknameValid,
  normalizeAndCapNickname,
  validateRegistrationNickname,
} from '@/helpers/profile/nickname-validation'

/**
 * Сид в событии не передаётся: шапка поднимает его из сейфа, когда регистрация
 * завершится (флаг `setNeedShowMnemonic`), и не держит в памяти всё ожидание (N6).
 */
interface ValidationPayload {
  status: 'in_progress_transaction'
  nickname: string
}

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false })

const emit = defineEmits<{
  'update:open': [value: boolean]
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

// Занятость имени проверяем, пока его набирают, а не только по нажатию: иначе
// о занятом имени человек узнавал уже после капчи. Номер запроса отсекает
// ответы на имя, которое успели изменить.
const nameTaken = ref(false)
let nameCheckTimer: ReturnType<typeof setTimeout> | null = null
let nameCheckSeq = 0

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

const isFormValid = computed<boolean>(() => isFormNicknameValid(nickname.value) && !nameTaken.value)

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
      cancelNameCheck()
    } else {
      checkPendingRegistration()
    }
  }
)

watch(nickname, scheduleNameCheck)

// Страховка от ранней размонтировки (роутинг увёз нас в момент, когда модалка
// открыта и timer заряжен): cleanup перед unmount гарантированно снимет setTimeout.
onBeforeUnmount(() => {
  if (nicknameTimer) {
    clearTimeout(nicknameTimer)
    nicknameTimer = null
  }
  cancelNameCheck()
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

/**
 * Незавершённая регистрация текущего аккаунта при открытии модалки: подставляем
 * ник и показываем причину отказа ноды, если он был (S13). Досыл транзакции
 * здесь не делаем — этим владеет флоу шапки (один путь, S15); чужую запись
 * (другой аккаунт устройства) не трогаем (V10).
 */
function checkPendingRegistration(): void {
  const pending = loadPendingRegistration()
  if (!pending || pending.address !== authStore.getUserAddress) return
  if (pending.nickname && !nickname.value) nickname.value = pending.nickname
  if (pending.error) {
    error.value = t('accountMsg.registrationRejected', {
      message: registrationRejectionReason(pending.error),
    })
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

  // Сессия, поверх которой регистрируем («Добавить аккаунт»): при отмене
  // возвращаемся к ней, а не в «не авторизован» (V9).
  const previousAddress = authStore.isUserAuthenticated ? authStore.getUserAddress : null
  // Адрес аккаунта, созданного в этой попытке (или переиспользованного из
  // прошлой неудачной), — чтобы откат снимал именно его.
  let createdAddress: string | null = null
  // До создания ключей сессию не трогаем: ошибка проверки имени при
  // «Добавить аккаунт» не должна разлогинивать текущий аккаунт.
  let keysTouched = false

  // Повтор после неудачной попытки: ключи прошлой уже сохранены, и pending
  // указывает на них — берём их с любым именем, а не минтим сироту (V9). Имя
  // с ключами не связано до userInfo-транзакции, а монеты на регистрацию уже
  // могли прийти на этот адрес: новые ключи просили бы их заново, и после
  // нескольких попыток сервер раздачи отвечал iplimit.
  const stale = loadPendingRegistration()
  const reuse = !!stale && stale.step >= 1 && stale.address === authStore.getUserAddress
  // Монеты этому адресу уже запрошены (step ≥ 2): аккаунт и его pending
  // переживают и отмену, и ошибку — других ключей с монетами нет.
  const funded = !!stale && reuse && stale.step >= 2

  // Отмена возможна только до «точки невозврата» (emit('validation')): сетевые
  // вызовы не принимают signal, поэтому прерываемся на границах шагов.
  const bailIfCancelled = (): void => {
    if (abortController?.signal.aborted) throw CANCELLED
  }

  try {
    debugLog('[REG] Step 1: checking name...')
    if (await checkNameTaken(nickname.value)) {
      // Об этом уже говорит подсказка под полем — отдельной плашки не нужно.
      nameTaken.value = true
      return
    }
    bailIfCancelled()

    let registrationResult: { address: string }
    if (stale && reuse) {
      debugLog('[REG] Step 2: reusing keys from the previous attempt:', stale.address)
      registrationResult = { address: stale.address }
    } else {
      keysTouched = true
      registrationResult = await freshRegistration()
    }
    createdAddress = registrationResult.address
    bailIfCancelled()

    // Монеты этому адресу уже запрошены — второй раз не просим: сервер
    // раздачи ответил бы uniq или iplimit, а капча была бы зря.
    if (!funded) {
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
    }

    // step=2: free/balance отправлен в сервер, ждём подтверждения (UTXO).
    savePendingRegistration({
      nickname: nickname.value,
      address: registrationResult.address,
      step: 2,
      timestamp: Date.now(),
    })

    debugLog('[REG] Step 4: optimistic — showing validation modal')
    // Точка невозврата: аккаунт создан, транзакцию дальше ведёт флоу шапки
    // (handleRegisterValidation → sendRegistrationUserInfoTx).
    emit('validation', {
      status: 'in_progress_transaction',
      nickname: nickname.value,
    })
  } catch (err) {
    // Отмена пользователем: снимаем созданный аккаунт (секрет, запись в списке,
    // pending) и возвращаемся к прежней сессии, если она была (V9); ошибку не
    // показываем.
    if (err === CANCELLED || isCancelling.value) {
      // pending созданного аккаунта снимает discardRegistration; чужой или
      // прошлой попытки с монетами не трогаем.
      if (!funded) {
        if (createdAddress) await authStore.discardRegistration(createdAddress, previousAddress)
        else if (keysTouched) authStore.resetAuthOnRegistrationError()
      }
      nickname.value = ''
      email.value = ''
      error.value = null
      emit('cancel')
      emit('update:open', false)
      return
    }
    console.error('[REG] ERROR:', err)
    error.value = err instanceof Error ? err.message : t('auth.errorRegistration')
    // Аккаунт уже персистнут (step ≥ 1) — оставляем: повтор переиспользует его.
    const pending = loadPendingRegistration()
    if (!pending || pending.step < 1) {
      if (createdAddress) await authStore.discardRegistration(createdAddress, previousAddress)
      else if (keysTouched) authStore.resetAuthOnRegistrationError()
    }
  } finally {
    loading.value = false
    abortController = null
  }
}
/** Новые ключи + персист аккаунта (шаг 2). */
async function freshRegistration(): Promise<{ address: string }> {
  debugLog('[REG] Step 2: generating keys...')
  const result = await authStore.register({ generateNew: true, saveAfterRegistration: true })
  if (!result?.address) throw new Error(t('auth.errorCreateAccount'))
  debugLog('[REG] Step 2: keys generated, address:', result.address)
  // Сид надо показать после завершения регистрации — даже если приложение
  // перезагрузят посередине (S12): флаг переживает сессию, память — нет.
  setNeedShowMnemonic(result.address)
  return { address: result.address }
}

/**
 * Имя занято другим адресом? Прокси отвечает конвертом `{ result, data: [...] }`
 * (раньше здесь ждали голый массив, и занятое имя не ловилось никогда); нода
 * ищет без учёта регистра. Сеть недоступна — бросает, решает вызывающий.
 */
async function isNameTaken(name: string): Promise<boolean> {
  const { rpcCallArray } = await import('@/helpers/api/request')
  const users = await rpcCallArray<UserAddressData>({
    method: 'getuseraddress',
    parameters: [name],
    options: { auth: false },
  })
  const owner = users[0]?.address
  return !!owner && owner !== authStore.getUserAddress
}

async function checkNameTaken(name: string): Promise<boolean> {
  try {
    return await isNameTaken(name)
  } catch (err) {
    // Нода недоступна — не блокируем: занятое имя отвергнет сама нода, а
    // повтор с другим именем пойдёт с теми же ключами и монетами.
    console.warn('[REG] name check failed:', err)
    return false
  }
}

function cancelNameCheck(): void {
  if (nameCheckTimer) {
    clearTimeout(nameCheckTimer)
    nameCheckTimer = null
  }
  nameCheckSeq++
  nameTaken.value = false
}

/** Проверка на лету: через полсекунды после ввода, только для допустимого имени. */
function scheduleNameCheck(): void {
  cancelNameCheck()
  const name = nickname.value
  if (!isFormNicknameValid(name)) return
  const seq = nameCheckSeq
  nameCheckTimer = setTimeout(async () => {
    nameCheckTimer = null
    try {
      const taken = await isNameTaken(name)
      if (seq === nameCheckSeq) nameTaken.value = taken
    } catch {
      // Сеть — проверим ещё раз по нажатию «Зарегистрироваться».
    }
  }, 500)
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
