<template>
  <Modal
    v-model:open="visible"
    :width="400"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :z-index="2600"
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
import { useConfirmSignOutModal } from './confirm-sign-out-modal'
import type { ConfirmSignOutModalProps, ConfirmSignOutModalEmits } from './types'

const p = withDefaults(defineProps<ConfirmSignOutModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmSignOutModalEmits>()

const {
  Modal,
  Button,
  ExclamationCircleOutlined,
  visible,
  loading,
  handleConfirm,
  handleCancel
} = useConfirmSignOutModal(p, emit)
</script>
