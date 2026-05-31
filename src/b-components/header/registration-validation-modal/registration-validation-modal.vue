<template>
  <SC_ModalWrapper>
    <Modal
      v-model:open="isOpen"
      :title="title"
      :closable="true"
      :maskClosable="true"
      :centered="true"
      :width="500"
      wrapClassName="registration-validation-modal-wrap"
      @update:open="handleUpdateOpen"
    >
      <SC_Content>
        <SC_IconWrapper>
          <SC_Icon>⏳</SC_Icon>
        </SC_IconWrapper>

        <SC_Title>{{ title }}</SC_Title>

        <SC_Message>{{ message }}</SC_Message>

        <SC_Info>
          {{ t('auth.validationInfo') }}
        </SC_Info>
      </SC_Content>
    </Modal>
  </SC_ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modal/modal.vue'
import { useRegistrationValidationModal } from './registration-validation-modal'
import type { RegistrationValidationModalProps, RegistrationValidationModalEmits } from './types'
import {
  SC_ModalWrapper,
  SC_Content,
  SC_IconWrapper,
  SC_Icon,
  SC_Title,
  SC_Message,
  SC_Info,
} from './registration-validation-modal.styled'

const { t } = useI18n()

const p = defineProps<RegistrationValidationModalProps>()

const emit = defineEmits<RegistrationValidationModalEmits>()

const {
  isOpen,
  title,
  message,
  handleUpdateOpen,
} = useRegistrationValidationModal(p, emit)
</script>
