import { ref, watch } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import type { ConfirmDeleteModalProps, ConfirmDeleteModalEmits } from './types'


export function useConfirmDeleteModal(p: ConfirmDeleteModalProps, emit: ConfirmDeleteModalEmits) {
  const visible = ref(p.open)
  const loading = ref(false)

  watch(() => p.open, (newValue) => {
    visible.value = newValue
  })

  watch(visible, (newValue) => {
    emit('update:open', newValue ?? false)
  })

  function handleConfirm() {
    loading.value = true
    emit('confirm')
    // Закрываем модалку после подтверждения
    setTimeout(() => {
      visible.value = false
      loading.value = false
    }, 100)
  }

  function handleCancel() {
    visible.value = false
    emit('cancel')
  }

  return {
    Modal,
    Button,
    ExclamationCircleOutlined,
    visible,
    loading,
    handleConfirm,
    handleCancel
  }
}
