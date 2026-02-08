<template>
  <Modal
    :open="open"
    :width="400"
    :centered="true"
    :z-index="10004"
    @cancel="$emit('cancel')"
  >
    <template #title>
      <div style="display: flex; align-items: center; gap: 12px;">
        <ExclamationCircleOutlined style="font-size: 24px; color: #ff4d4f;" />
        <span>Удаление видео</span>
      </div>
    </template>

    <p v-if="video">
      Вы уверены, что хотите удалить <strong>{{ video.originalFileName }}</strong>?
      Это действие нельзя отменить.
    </p>

    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <Button type="default" @click="$emit('cancel')">Отмена</Button>
        <Button type="primary" danger @click="$emit('confirm')">
          Удалить
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useDeleteConfirmModal } from './delete-confirm-modal'
import type { DeleteConfirmModalProps, DeleteConfirmModalEmits } from './types'

defineProps<DeleteConfirmModalProps>()

defineEmits<DeleteConfirmModalEmits>()

const { Modal, Button, ExclamationCircleOutlined } = useDeleteConfirmModal()
</script>
