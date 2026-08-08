import { ref, watch, computed } from 'vue'
import { Alert } from 'ant-design-vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { useAuthStore } from '@/blockchain'
import { t } from '@/i18n'
import type { SignInModalProps, SignInModalEmits } from './types'
import {
  SC_SignInForm,
  SC_FormItem,
  SC_FormLabel,
  SC_InputWrapper,
  SC_InputWithToggle,
  SC_PasswordToggle,
  SC_ErrorMessage,
  SC_LinkToRegister,
  SC_LinkButton,
} from './styled'

export function useSignInModal(p: SignInModalProps, emit: SignInModalEmits) {
  const authStore = useAuthStore()
  const privateKey = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const showPassword = ref(false)
  const showQrScanner = ref(false)
  const modalKey = ref(0)

  // Управление отменой активного входа. `abortController` прерывает signIn на
  // ближайшей безопасной точке; `isCancelling` помечает, что закрытие было
  // намеренной отменой, чтобы не показывать ошибку и гарантировать разлогин.
  let abortController: AbortController | null = null
  const isCancelling = ref(false)

  // Функция очистки формы
  const clearForm = () => {
    privateKey.value = ''
    error.value = null
    loading.value = false
    showPassword.value = false
    showQrScanner.value = false
    isCancelling.value = false
    abortController = null
  }

  // Локальное состояние для v-model
  const isOpen = computed({
    get: () => p.open,
    set: (value) => {
      if (!value) {
        clearForm()
      }
      emit('update:open', value ?? false)
    },
  })

  // Очистка формы при закрытии и пересоздание компонента
  watch(
    () => p.open,
    (newValue, oldValue) => {
      if (oldValue && !newValue) {
        // Увеличиваем key для пересоздания компонента
        modalKey.value++
        clearForm()
      }
    },
    { immediate: false }
  )

  const handleSignIn = async () => {
    // Защита от повторного запуска, пока идёт вход (двойной клик / Enter + клик).
    if (loading.value) return

    if (!privateKey.value.trim()) {
      error.value = t('accountMsg.enterMnemonicOrKey')
      return
    }

    loading.value = true
    error.value = null
    isCancelling.value = false
    abortController = new AbortController()

    try {
      const result = await authStore.signIn(
        { privateKey: privateKey.value.trim() },
        { signal: abortController.signal }
      )

      // Пользователь нажал «Отмена» во время входа: гарантируем, что он не
      // остался залогинен (если signIn всё же успел зафиксироваться), и молча
      // закрываем модалку без сообщения об ошибке.
      if (isCancelling.value || result.cancelled) {
        if (result.success) await authStore.signOut()
        clearForm()
        emit('cancel')
        emit('update:open', false)
        return
      }

      if (result.success) {
        clearForm()
        emit('success')
        emit('update:open', false)
      } else {
        error.value = result.error || t('accountMsg.signInError')
      }
    } catch (err) {
      if (isCancelling.value) {
        clearForm()
        emit('cancel')
        emit('update:open', false)
        return
      }
      error.value = err instanceof Error ? err.message : t('accountMsg.signInUnexpectedError')
    } finally {
      loading.value = false
      abortController = null
    }
  }

  const handleCancel = () => {
    // Отмена во время активного входа: прерываем запрос и ждём, пока handleSignIn
    // доведёт откат и закроет модалку. Не закрываем здесь, чтобы не разорвать
    // процесс на полпути (иначе signIn мог бы зафиксироваться уже после закрытия).
    if (loading.value) {
      isCancelling.value = true
      abortController?.abort()
      return
    }
    clearForm()
    emit('cancel')
    emit('update:open', false)
  }

  const handleOpenRegister = () => {
    // Во время входа переключение на регистрацию заблокировано.
    if (loading.value) return
    clearForm()
    emit('openRegister')
    emit('update:open', false)
  }

  const toggleQrScanner = () => {
    if (loading.value) return
    showQrScanner.value = !showQrScanner.value
    if (showQrScanner.value) error.value = null
  }

  // QR закодирован мнемоникой/приватным ключом (legacy кодирует строку как есть).
  // Декодированный текст подставляем в поле и сразу логинимся.
  const handleQrDecoded = (text: string) => {
    const value = (text ?? '').trim()
    if (!value) return
    privateKey.value = value
    showQrScanner.value = false
    handleSignIn()
  }

  return {
    Modal,
    Button,
    Alert,
    SC_SignInForm,
    SC_FormItem,
    SC_FormLabel,
    SC_InputWrapper,
    SC_InputWithToggle,
    SC_PasswordToggle,
    SC_ErrorMessage,
    SC_LinkToRegister,
    SC_LinkButton,
    privateKey,
    loading,
    error,
    showPassword,
    showQrScanner,
    modalKey,
    isOpen,
    isCancelling,
    handleSignIn,
    handleCancel,
    handleOpenRegister,
    toggleQrScanner,
    handleQrDecoded,
  }
}
