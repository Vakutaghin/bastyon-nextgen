import Modal from '@/components/modal/modal.vue'
import Button from '@/components/button/button.vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'

export function useDeleteConfirmModal() {
  return {
    Modal,
    Button,
    ExclamationCircleOutlined
  }
}
