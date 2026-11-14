<template>
  <SC_Toast
    class="ui-toast"
    :data-type="item.type"
    :data-clickable="item.onClick ? '' : undefined"
    @mouseenter="onMouseenter"
    @mouseleave="onMouseleave"
    @focusin="onFocusin"
    @focusout="onFocusout"
    @click="onClick"
  >
    <component :is="ICONS[item.type]" class="ui-toast__icon" />
    <div class="ui-toast__message">{{ item.message }}</div>
    <div v-if="item.description" class="ui-toast__description">{{ item.description }}</div>
    <button
      v-if="item.closable"
      type="button"
      class="ui-toast__close"
      data-testid="toast-close"
      :aria-label="t('common.close')"
      @click.stop="close"
    >
      <CloseOutlined />
    </button>
  </SC_Toast>
</template>

<script setup lang="ts">
// Один тост: значок вида, заголовок, описание, крестик. Озвучивает тост
// appToast (announce), поэтому aria-live здесь нет — диктор не прочтёт дважды.
import type { Component } from 'vue'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from '@/components/icons'
import { t } from '@/i18n'
import { useToast } from './toast'
import type { ToastItem, ToastType } from './types'
import { SC_Toast } from './styled'

const props = defineProps<{ item: ToastItem }>()

const ICONS: Record<ToastType, Component> = {
  success: CheckCircleOutlined,
  info: InfoCircleOutlined,
  warning: ExclamationCircleOutlined,
  error: CloseCircleOutlined,
  loading: LoadingOutlined,
}

const { onMouseenter, onMouseleave, onFocusin, onFocusout, onClick, close } = useToast(
  () => props.item
)
</script>
