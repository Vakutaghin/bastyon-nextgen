<template>
  <SC_Alert class="ui-alert" :data-type="type" :role="type === 'error' ? 'alert' : undefined">
    <component :is="ICONS[type]" v-if="showIcon" class="ui-alert__icon" />
    <div class="ui-alert__content">
      <div v-if="title || $slots.title" class="ui-alert__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="$slots.description || $slots.default" class="ui-alert__description">
        <slot name="description"><slot /></slot>
      </div>
    </div>
  </SC_Alert>
</template>

<script setup lang="ts">
// Плашка с пояснением вместо antd Alert: значок, заголовок и текст на
// подложке цвета вида (info / success / warning / error). Ошибка — role="alert":
// диктор прочтёт её сразу.
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@/components/icons'
import type { AlertProps, AlertType } from './types'
import { SC_Alert } from './styled'

withDefaults(defineProps<AlertProps>(), { type: 'info', title: undefined, showIcon: false })

const ICONS: Record<AlertType, unknown> = {
  info: InfoCircleOutlined,
  success: CheckCircleOutlined,
  warning: ExclamationCircleOutlined,
  error: CloseCircleOutlined,
}
</script>
