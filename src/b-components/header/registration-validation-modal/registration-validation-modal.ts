/**
 * Логика модального окна валидации регистрации
 */

import { computed } from 'vue'
import type { RegistrationValidationModalProps, RegistrationValidationModalEmits } from './types'
import { t } from '@/i18n'

export function useRegistrationValidationModal(
  p: RegistrationValidationModalProps,
  emit: RegistrationValidationModalEmits
) {
  const isOpen = computed({
    get: () => p.open ?? false,
    set: (value: boolean) => {
      emit('update:open', value)
    },
  })

  const title = computed(() => {
    return t('accountMsg.validationTitle')
  })

  const message = computed(() => {
    return t('accountMsg.validationMessage')
  })

  const handleUpdateOpen = (value: boolean) => {
    isOpen.value = value
  }

  return {
    isOpen,
    title,
    message,
    handleUpdateOpen,
  }
}
