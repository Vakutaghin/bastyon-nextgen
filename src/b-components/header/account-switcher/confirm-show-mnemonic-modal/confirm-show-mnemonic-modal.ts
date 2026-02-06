import { ref, watch } from 'vue'
import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { WarningOutlined } from '@ant-design/icons-vue'
import type { ConfirmShowMnemonicModalProps, ConfirmShowMnemonicModalEmits } from './types'

export function useConfirmShowMnemonicModal(
  p: ConfirmShowMnemonicModalProps,
  emit: ConfirmShowMnemonicModalEmits,
) {
  const visible = ref(p.open)
  const loading = ref(false)

  watch(() => p.open, (newValue) => {
    visible.value = newValue
  })

  watch(visible, (newValue) => {
    emit('update:open', newValue)
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
    WarningOutlined,
    visible,
    loading,
    handleConfirm,
    handleCancel
  }
}
