/**
 * Логика модального окна валидации регистрации
 */

import { computed } from 'vue'
import type { RegistrationValidationModalProps, RegistrationValidationModalEmits } from './types'

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
    return 'Валидация аккаунта в блокчейне'
  })

  const message = computed(() => {
    return 'Ваш аккаунт проходит валидацию в блокчейне. Пожалуйста, подождите...'
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
