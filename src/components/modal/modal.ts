import { computed, useAttrs } from 'vue'
import { Modal } from 'ant-design-vue'
import { SC_Modal } from './styled'
import type { ModalProps, ModalEmits } from './types'

export function useModal(p: ModalProps, emit: ModalEmits) {
  const attrs = useAttrs()
  const { open: _o, width: _w, ...restAttrs } = attrs as Record<string, unknown>

  const otherAttrs = restAttrs as Omit<Record<string, unknown>, 'open' | 'width'>

  const isOpen = computed({
    get: () => {
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

  const modalClass = computed(() => ({}))
  const wrapClassName = computed(() => 'bastyon-modal-wrap')

  // Пропсы объявлены в ModalProps, но раньше не прокидывались в AModal — из-за
  // этого `:closable="false"` / `:maskClosable="false"` не работали (крестик и
  // клик по маске оставались активны). Прокидываем явно; `undefined` оставляет
  // дефолт ant (true), поэтому существующие модалки не меняют поведение.
  const closable = computed(() => p.closable)
  const maskClosable = computed(() => p.maskClosable)

  const width = computed(() =>
    p.fullWidth ? '95vw' : (p.width !== undefined ? p.width : (attrs as Record<string, unknown>).width)
  )

  const maskStyle = computed(() => ({
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(4px)'
  }))

  const bodyStyle = computed(() => ({
    maxHeight: '90vh',
    overflowY: 'auto'
  }))

  return {
    Modal,
    SC_Modal,
    isOpen,
    otherAttrs,
    modalClass,
    wrapClassName,
    width,
    maskStyle,
    bodyStyle,
    closable,
    maskClosable,
    handleUpdateOpen,
    handleCancel
  }
}
