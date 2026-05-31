/**
 * Логика компонента модального окна капчи
 */

import { ref, computed, watch } from 'vue'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { t } from '@/i18n'

// Типы для использования в composable и других местах
export interface CaptchaModalProps {
  open?: boolean
  captcha: CaptchaData | null
  reason?: string
  proxyOptions?: { proxy?: string }
}

export interface CaptchaModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'success', captcha: CaptchaData): void
  (e: 'error', error: string): void
  (e: 'cancel'): void
}

// Экспортируем типы для использования в других местах
export type { CaptchaModalProps, CaptchaModalEmits }

export function useCaptchaModal(
  p: CaptchaModalProps,
  emit: CaptchaModalEmits
) {
  const isOpen = computed({
    get: () => p.open ?? false,
    set: (value: boolean) => emit('update:open', value),
  })

  const error = ref<string | null>(null)

  const title = computed(() => {
    if (!p.reason) return t('accountMsg.captchaTitle')
    const titles: Record<string, string> = {
      registration: t('accountMsg.reasonRegistration'),
      balance: t('accountMsg.reasonBalance'),
    }
    return titles[p.reason] || t('accountMsg.captchaTitle')
  })

  const handleUpdateOpen = (value: boolean) => {
    isOpen.value = value
  }

  const handleCancel = () => {
    isOpen.value = false
    emit('cancel')
  }

  const handleSuccess = (captcha: CaptchaData) => {
    error.value = null
    // Закрываем модальное окно сразу после успешного решения капчи
    isOpen.value = false
    // Эмитим событие success после закрытия
    emit('success', captcha)
  }

  const handleError = (errorMessage: string) => {
    error.value = errorMessage
    emit('error', errorMessage)
  }

  const handleRedo = async () => {
    error.value = null
    // Обновление капчи - эмитим событие для родительского компонента
    // Родительский компонент должен обновить капчу через API
    emit('redo')
  }

  // Сбрасываем ошибку при изменении капчи
  watch(() => p.captcha, () => {
    error.value = null
  })

  return {
    isOpen,
    error,
    title,
    handleUpdateOpen,
    handleCancel,
    handleSuccess,
    handleError,
    handleRedo,
  }
}
