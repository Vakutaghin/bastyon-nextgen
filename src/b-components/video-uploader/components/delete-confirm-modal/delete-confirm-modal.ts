import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { ExclamationCircleOutlined } from '@/components/icons'

export function useDeleteConfirmModal() {
  return {
    Modal,
    Button,
    ExclamationCircleOutlined,
  }
}
