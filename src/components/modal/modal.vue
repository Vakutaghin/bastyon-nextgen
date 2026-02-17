<template>
  <SC_Modal>
    <Modal
      :open="isOpen"
      :width="width"
      :class="['bastyon-modal', modalClass]"
      :wrapClassName='wrapClassName'
      :maskStyle='maskStyle'
      :bodyStyle='bodyStyle'
      v-bind='otherAttrs'
      @update:open="handleUpdateOpen"
      @cancel="handleCancel"
    >
      <template #title>
        <slot name='title' />
      </template>
      <template #footer>
        <slot name='footer' />
      </template>
      <slot />
    </Modal>
  </SC_Modal>
</template>

<script setup lang='ts'>
import { useModal } from './modal'
import type { ModalProps, ModalEmits } from './types'

const p = defineProps<ModalProps>()

const emit = defineEmits<ModalEmits>()

const {
  Modal,
  SC_Modal,
  isOpen,
  otherAttrs,
  modalClass,
  wrapClassName,
  width,
  maskStyle,
  bodyStyle,
  handleUpdateOpen,
  handleCancel
} = useModal(p, emit)
</script>
