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
        <span>{{ t('auth.signOutTitle') }}</span>
      </SC_ModalIconRow>
    </template>

    <SC_ModalBody>
      <p>{{ t('auth.signOutConfirm') }}</p>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" @click="handleCancel">{{ t('auth.no') }}</Button>
        <Button type="primary" danger @click="handleConfirm" :loading="loading"> {{ t('auth.yesSignOut') }} </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useConfirmSignOutModal } from './confirm-sign-out-modal'
import type { ConfirmSignOutModalProps, ConfirmSignOutModalEmits } from './types'
import { SC_ModalActions, SC_ModalBody, SC_ModalIconRow } from '@/components/modal'
import { ICON_WARNING_24 } from '@/styles/icon-styles'

const { t } = useI18n()

const p = withDefaults(defineProps<ConfirmSignOutModalProps>(), {
  open: false,
})

const emit = defineEmits<ConfirmSignOutModalEmits>()

const { Modal, Button, ExclamationCircleOutlined, visible, loading, handleConfirm, handleCancel } =
  useConfirmSignOutModal(p, emit)
</script>
