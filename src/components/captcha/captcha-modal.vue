<template>
  <SC_CaptchaModalWrapper>
    <Modal
      :open="isOpen"
      :title="title"
      :closable="false"
      :maskClosable="false"
      :centered="true"
      :width="450"
      wrapClassName="captcha-modal-wrap"
      @update:open="handleUpdateOpen"
      @cancel="handleCancel"
    >
      <template #footer>
        <!-- Footer пустой, кнопки внутри компонента капчи -->
      </template>

      <Captcha
        v-if="captcha"
        :key="captcha.id"
        :captcha="captcha"
        :reason="reason"
        :proxy-options="proxyOptions"
        @success="handleSuccess"
        @error="handleError"
        @redo="handleRedo"
      />

      <SC_ErrorMessage v-if="error">
        {{ error }}
      </SC_ErrorMessage>
    </Modal>
  </SC_CaptchaModalWrapper>
</template>

<script setup lang="ts">
import Modal from '@/components/modal/modal.vue'
import Captcha from './captcha.vue'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { useCaptchaModal } from './captcha-modal'
import { SC_ErrorMessage, SC_CaptchaModalWrapper } from './captcha-modal.styled'

const p = defineProps<{
  open?: boolean
  captcha: CaptchaData | null
  reason?: string
  proxyOptions?: { proxy?: string }
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'success', captcha: CaptchaData): void
  (e: 'error', error: string): void
  (e: 'cancel'): void
  (e: 'redo'): void
}>()

const {
  isOpen,
  error,
  title,
  handleUpdateOpen,
  handleCancel,
  handleSuccess,
  handleError,
  handleRedo,
} = useCaptchaModal(p, emit)
</script>
