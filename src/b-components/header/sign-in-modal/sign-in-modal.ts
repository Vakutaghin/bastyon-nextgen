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

  // Функция очистки формы
  const clearForm = () => {
    privateKey.value = ''
    error.value = null
    loading.value = false
    showPassword.value = false
    showQrScanner.value = false
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
    if (!privateKey.value.trim()) {
      error.value = t('accountMsg.enterMnemonicOrKey')
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await authStore.signIn({
        privateKey: privateKey.value.trim(),
      })

      if (result.success) {
        clearForm()
        emit('success')
        emit('update:open', false)
      } else {
        error.value = result.error || t('accountMsg.signInError')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('accountMsg.signInUnexpectedError')
    } finally {
      loading.value = false
    }
  }

  const handleCancel = () => {
    clearForm()
    emit('cancel')
    emit('update:open', false)
  }

  const handleOpenRegister = () => {
    clearForm()
    emit('openRegister')
    emit('update:open', false)
  }

  const toggleQrScanner = () => {
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
    handleSignIn,
    handleCancel,
    handleOpenRegister,
    toggleQrScanner,
    handleQrDecoded,
  }
}
