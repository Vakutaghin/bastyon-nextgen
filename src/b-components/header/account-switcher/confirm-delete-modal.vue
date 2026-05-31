<template>
  <Modal
    v-model:open="visible"
    :width="400"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :z-index="2700"
    @cancel="handleCancel"
  >
    <template #title>
      <SC_ModalIconRow>
        <ExclamationCircleOutlined :style="ICON_WARNING_24" />
        <span>{{ t('accounts.logoutConfirm') }}</span>
      </SC_ModalIconRow>
    </template>

    <SC_ModalBody>
      <p>{{ t('accounts.logoutQuestion') }}</p>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="handleCancel">{{ t('accounts.no') }}</Button>
        <Button type="primary" danger @click="handleConfirm" :loading="loading"> {{ t('accounts.yesLogout') }} </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useConfirmDeleteModal } from './confirm-delete-modal/confirm-delete-modal'
import type { ConfirmDeleteModalProps, ConfirmDeleteModalEmits } from './confirm-delete-modal/types'
import { SC_ModalActions, SC_ModalBody, SC_ModalIconRow } from '@/components/modal'
import { ICON_WARNING_24 } from '@/styles/icon-styles'

const p = withDefaults(defineProps<ConfirmDeleteModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmDeleteModalEmits>()

const { t } = useI18n()

const { Modal, Button, ExclamationCircleOutlined, visible, loading, handleConfirm, handleCancel } =
  useConfirmDeleteModal(p, emit)
</script>
