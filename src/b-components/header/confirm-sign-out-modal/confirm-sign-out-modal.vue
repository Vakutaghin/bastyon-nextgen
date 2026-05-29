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
      <SC_ModalIconRow>
        <ExclamationCircleOutlined :style="ICON_WARNING_24" />
        <span>Выйти?</span>
      </SC_ModalIconRow>
    </template>

    <SC_ModalBody>
      <p>Вы уверены, что хотите выйти из аккаунта? Это действие нельзя отменить.</p>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="handleCancel">Нет</Button>
        <Button type="primary" danger @click="handleConfirm" :loading="loading"> Да, выйти </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useConfirmSignOutModal } from './confirm-sign-out-modal'
import type { ConfirmSignOutModalProps, ConfirmSignOutModalEmits } from './types'
import { SC_ModalActions, SC_ModalBody, SC_ModalIconRow } from '@/components/modal'
import { ICON_WARNING_24 } from '@/styles/icon-styles'

const p = withDefaults(defineProps<ConfirmSignOutModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmSignOutModalEmits>()

const { Modal, Button, ExclamationCircleOutlined, visible, loading, handleConfirm, handleCancel } =
  useConfirmSignOutModal(p, emit)
</script>
