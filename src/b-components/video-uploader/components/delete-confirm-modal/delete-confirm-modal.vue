<template>
  <Modal :open="open" :width="400" :centered="true" :z-index="10004" @cancel="$emit('cancel')">
    <template #title>
      <SC_ModalIconRow>
        <ExclamationCircleOutlined style="font-size: 24px; color: #ff4d4f" />
        <span>Удаление видео</span>
      </SC_ModalIconRow>
    </template>

    <p v-if="video">
      Вы уверены, что хотите удалить <strong>{{ video.originalFileName }}</strong
      >? Это действие нельзя отменить.
    </p>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="$emit('cancel')">Отмена</Button>
        <Button type="primary" danger @click="$emit('confirm')"> Удалить </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useDeleteConfirmModal } from './delete-confirm-modal'
import type { DeleteConfirmModalProps, DeleteConfirmModalEmits } from './types'
import { SC_ModalActions, SC_ModalIconRow } from '@/components/modal'

defineProps<DeleteConfirmModalProps>()

defineEmits<DeleteConfirmModalEmits>()

const { Modal, Button, ExclamationCircleOutlined } = useDeleteConfirmModal()
</script>
