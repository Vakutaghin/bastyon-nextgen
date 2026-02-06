<template>
  <Modal
    v-model:open="visible"
    :width="400"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    @cancel="handleCancel"
  >
    <template #title>
      <div style="display: flex; align-items: center; gap: 12px;">
        <ExclamationCircleOutlined style="font-size: 24px; color: #faad14;" />
        <span>Выйти?</span>
      </div>
    </template>

    <div style="padding: 16px 0;">
      <p>Вы уверены, что хотите выйти из аккаунта? Это действие нельзя отменить.</p>
    </div>

    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <Button type="default" @click="handleCancel">Нет</Button>
        <Button type="primary" danger @click="handleConfirm" :loading="loading">
          Да, выйти
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useConfirmDeleteModal } from './confirm-delete-modal/confirm-delete-modal'
import type { ConfirmDeleteModalProps, ConfirmDeleteModalEmits } from './confirm-delete-modal/types'

const p = withDefaults(defineProps<ConfirmDeleteModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmDeleteModalEmits>()

const {
  Modal,
  Button,
  ExclamationCircleOutlined,
  visible,
  loading,
  handleConfirm,
  handleCancel
} = useConfirmDeleteModal(p, emit)
</script>
