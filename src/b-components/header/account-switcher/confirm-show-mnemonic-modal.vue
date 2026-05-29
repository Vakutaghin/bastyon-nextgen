<template>
  <Modal
    v-model:open="visible"
    :width="500"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :z-index="2700"
    @cancel="handleCancel"
  >
    <template #title>
      <SC_ModalIconRow>
        <WarningOutlined :style="ICON_WARNING_24" />
        <span>Показать сид-фразу?</span>
      </SC_ModalIconRow>
    </template>

    <SC_ModalBody>
      <div
        style="
          margin-bottom: 16px;
          padding: 12px;
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 4px;
        "
      >
        <p style="margin: 0; color: #856404; font-weight: 500">⚠️ Внимание!</p>
        <p style="margin: 8px 0 0 0; color: #856404">
          Передавать сид-фразу кому-либо небезопасно. Любой, кто получит доступ к вашей сид-фразе,
          сможет получить полный контроль над вашим аккаунтом и средствами.
        </p>
      </div>
      <p>Вы уверены, что хотите показать сид-фразу?</p>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="handleCancel">Нет</Button>
        <Button type="primary" @click="handleConfirm" :loading="loading"> Да, показать </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useConfirmShowMnemonicModal } from './confirm-show-mnemonic-modal/confirm-show-mnemonic-modal'
import type {
  ConfirmShowMnemonicModalProps,
  ConfirmShowMnemonicModalEmits,
} from './confirm-show-mnemonic-modal/types'
import { SC_ModalActions, SC_ModalBody, SC_ModalIconRow } from '@/components/modal'
import { ICON_WARNING_24 } from '@/styles/icon-styles'

const p = withDefaults(defineProps<ConfirmShowMnemonicModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmShowMnemonicModalEmits>()

const { Modal, Button, WarningOutlined, visible, loading, handleConfirm, handleCancel } =
  useConfirmShowMnemonicModal(p, emit)
</script>
