import { computed, useAttrs } from 'vue'
import { Modal } from 'ant-design-vue'
import { SC_Modal } from './styled'
import type { ModalProps, ModalEmits } from './types'

export function useModal(p: ModalProps, emit: ModalEmits) {
  const attrs = useAttrs()
  // Исключаем open из attrs, так как мы управляем им отдельно
  const { open: _, ...otherAttrs } = attrs

  // Используем computed для v-model:open
  // Приоритет: p.open (для v-model:open) > p.modelValue (для v-model)
  const isOpen = computed({
    get: () => {
      // Приоритет: p.open (для v-model:open) > p.modelValue (для v-model)
      // Проверяем явно на undefined, так как false тоже валидное значение
      return p.open !== undefined ? p.open : (p.modelValue !== undefined ? p.modelValue : false)
    },
    set: (value: boolean) => {
      emit('update:open', value)
      emit('update:modelValue', value)
    }
  })

  const handleUpdateOpen = (value: boolean) => {
    isOpen.value = value
  }

  const handleCancel = () => {
    isOpen.value = false
    emit('cancel')
    if (p.onCancel) {
      p.onCancel()
    }
  }

  const modalClass = computed(() => {
    return {}
  })

  const wrapClassName = computed(() => {
    return 'bastyon-modal-wrap'
  })

  const maskStyle = computed(() => {
    return {
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(4px)'
    }
  })

  const bodyStyle = computed(() => {
    return {
      maxHeight: '90vh',
      overflowY: 'auto'
    }
  })

  return {
    Modal,
    SC_Modal,
    isOpen,
    otherAttrs,
    modalClass,
    wrapClassName,
    maskStyle,
    bodyStyle,
    handleUpdateOpen,
    handleCancel
  }
}
