<template>
  <Modal
    :open="open"
    :width="options.width ?? 416"
    :centered="options.centered"
    :closable="false"
    :mask-closable="options.maskClosable ?? false"
    :keyboard="options.keyboard"
    :footer="null"
    :class="['ui-confirm', options.class]"
    :aria-label="typeof options.title === 'string' ? options.title : undefined"
    @cancel="onCancel"
    @after-close="emit('closed')"
  >
    <SC_Confirm :data-kind="kind">
      <div class="ui-confirm__body">
        <span v-if="options.icon !== null" class="ui-confirm__icon">
          <component :is="iconNode" />
        </span>
        <div class="ui-confirm__text">
          <div v-if="options.title" class="ui-confirm__title">
            <component :is="render(options.title)" />
          </div>
          <div v-if="options.content" class="ui-confirm__content">
            <component :is="render(options.content)" />
          </div>
        </div>
      </div>
      <div class="ui-confirm__buttons">
        <Button v-if="kind === 'confirm'" @click="onCancel">
          {{ options.cancelText ?? t('common.cancel') }}
        </Button>
        <Button
          type="primary"
          data-autofocus
          :danger="danger"
          :disabled="options.okButtonProps?.disabled"
          :loading="loading"
          @click="onOk"
        >
          {{ options.okText ?? 'OK' }}
        </Button>
      </div>
    </SC_Confirm>
  </Modal>
</template>

<script setup lang="ts">
// Окно вопроса или сообщения (confirm / info / success / error / warning)
// вместо antd Modal.confirm: значок вида, заголовок, текст, кнопки справа.
// Монтирует его dialogs.ts; закрытие — через событие closed после анимации.
import { computed, h, ref, type Component, type VNodeChild } from 'vue'
import Button from '@/components/button'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  InfoCircleOutlined,
} from '@/components/icons'
import { t } from '@/i18n'
import Modal from './modal.vue'
import type { DialogContent, DialogKind, DialogOptions } from './dialog-types'
import { SC_Confirm } from './styled'

const props = defineProps<{ kind: DialogKind; options: DialogOptions; open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'closed'): void
}>()

const ICONS: Record<DialogKind, Component> = {
  confirm: ExclamationCircleFilled,
  warning: ExclamationCircleFilled,
  info: InfoCircleOutlined,
  success: CheckCircleFilled,
  error: CloseCircleFilled,
}

const iconNode = computed(() => {
  const icon = props.options.icon
  if (icon) return typeof icon === 'function' ? icon : () => icon
  return ICONS[props.kind]
})

const danger = computed<boolean>(
  () =>
    Boolean(props.options.danger) ||
    props.options.okType === 'danger' ||
    Boolean(props.options.okButtonProps?.danger)
)

const loading = ref(false)

function render(value: DialogContent): () => VNodeChild {
  if (typeof value === 'function') return value
  if (typeof value === 'string') return () => h('span', value)
  return () => value
}

async function onOk(): Promise<void> {
  const result = props.options.onOk?.()
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    loading.value = true
    try {
      await result
    } catch (e) {
      // Как у antd: отказ оставляет окно открытым, кнопка снова доступна.
      loading.value = false
      console.error(e)
      return
    }
    loading.value = false
  }
  emit('close')
}

function onCancel(): void {
  props.options.onCancel?.()
  emit('close')
}
</script>
