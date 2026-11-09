<template>
  <SC_Modal>
    <Modal
      v-bind="{ ...restAttrs(), ...forwarded }"
      :wrapProps="wrapProps()"
      :open="isOpen"
      :width="width"
      :footer="footer"
      :class="['bastyon-modal', modalClass]"
      :wrapClassName="wrapClassName"
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
import { useAttrs, useSlots } from 'vue'
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

// Для диктора: окно модальное (aria-modal), а у окна без заголовка название
// из aria-label. Оба — на элемент с role=dialog: у antd это обёртка (wrapProps),
// а прочие атрибуты antd ставит на корень, где aria-label недопустим.
// Функции, а не computed: $attrs не реактивны, шаблон и так перерисуется.
const attrs = useAttrs()
const OWN_ATTRS = new Set(['aria-label', 'wrapProps'])
function restAttrs(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => !OWN_ATTRS.has(key)))
}
function wrapProps(): Record<string, unknown> {
  const label = attrs['aria-label']
  return {
    'aria-modal': 'true',
    ...(label ? { 'aria-label': label } : {}),
    ...((attrs.wrapProps as Record<string, unknown> | undefined) ?? {}),
  }
}

const {
  Modal,
  SC_Modal,
  isOpen,
  forwarded,
  footer,
  modalClass,
  wrapClassName,
  width,
  bodyStyle,
  closable,
  maskClosable,
  handleUpdateOpen,
  handleCancel,
} = useModal(p, emit, useSlots())
</script>
