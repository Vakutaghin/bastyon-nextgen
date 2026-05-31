<template>
  <Modal :open="open" :width="400" :centered="true" :z-index="10004" @cancel="$emit('cancel')">
    <template #title>
      <SC_ModalIconRow>
        <ExclamationCircleOutlined style="font-size: 24px; color: var(--color-red-ant)" />
        <span>{{ t('videoUploader.deleteTitle') }}</span>
      </SC_ModalIconRow>
    </template>

    <p v-if="video">
      {{ t('videoUploader.deleteConfirmBefore') }} <strong>{{ video.originalFileName }}</strong
      >{{ t('videoUploader.deleteConfirmAfter') }}
    </p>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="$emit('cancel')">{{ t('videoUploader.cancel') }}</Button>
        <Button type="primary" danger @click="$emit('confirm')"> {{ t('videoUploader.delete') }} </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDeleteConfirmModal } from './delete-confirm-modal'
import type { DeleteConfirmModalProps, DeleteConfirmModalEmits } from './types'
import { SC_ModalActions, SC_ModalIconRow } from '@/components/modal'

const { t } = useI18n()

defineProps<DeleteConfirmModalProps>()

defineEmits<DeleteConfirmModalEmits>()

const { Modal, Button, ExclamationCircleOutlined } = useDeleteConfirmModal()
</script>
