<template>
  <SC_Modal>
    <Modal
      v-bind="{ ...$attrs, ...forwarded }"
      :open="isOpen"
      :width="width"
      :footer="footer"
      :class="['bastyon-modal', modalClass]"
      :wrapClassName="wrapClassName"
      :maskStyle="maskStyle"
      :bodyStyle="bodyStyle"
      :closable="closable"
      :maskClosable="maskClosable"
      @update:open="handleUpdateOpen"
      @cancel="handleCancel"
    >
      <template v-if="$slots.title" #title>
        <slot name="title" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
      <slot />
    </Modal>
  </SC_Modal>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'
import { useModal } from './modal'
import type { ModalProps, ModalEmits } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<ModalProps>(), {
  modelValue: undefined,
  open: undefined,
  fullWidth: undefined,
  centered: undefined,
  closable: undefined,
  maskClosable: undefined,
  destroyOnClose: undefined,
  // VNodeChild включает boolean → без default Vue кастует отсутствие в false.
  footer: undefined,
})

const emit = defineEmits<ModalEmits>()

const {
  Modal,
  SC_Modal,
  isOpen,
  forwarded,
  footer,
  modalClass,
  wrapClassName,
  width,
  maskStyle,
  bodyStyle,
  closable,
  maskClosable,
  handleUpdateOpen,
  handleCancel,
} = useModal(p, emit, useSlots())
</script>
