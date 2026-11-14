<template>
  <Popover
    v-model:open="open"
    trigger="click"
    :placement="placement"
    role="alertdialog"
    :panel-label="title"
  >
    <template #content>
      <SC_Popconfirm class="ui-popconfirm">
        <div class="ui-popconfirm__message">
          <ExclamationCircleFilled class="ui-popconfirm__icon" />
          <div class="ui-popconfirm__title">{{ title }}</div>
        </div>
        <div v-if="description" class="ui-popconfirm__description">{{ description }}</div>
        <div class="ui-popconfirm__buttons">
          <Button size="small" @click="cancel">{{ cancelText }}</Button>
          <Button size="small" type="primary" :danger="danger" @click="confirm">
            {{ okText }}
          </Button>
        </div>
      </SC_Popconfirm>
    </template>
    <slot />
  </Popover>
</template>

<script setup lang="ts">
// Подтверждение у кнопки вместо antd Popconfirm: вопрос, пояснение и две
// кнопки в панели Popover (role="alertdialog"). С клавиатуры фокус — на
// «Отмена», безопасную кнопку.
import { ref } from 'vue'
import Button from '@/components/button'
import Popover from '@/components/popover'
import { ExclamationCircleFilled } from '@/components/icons'
import type { PopconfirmEmits, PopconfirmProps } from './types'
import { SC_Popconfirm } from './styled'

withDefaults(defineProps<PopconfirmProps>(), {
  description: undefined,
  danger: false,
  placement: 'top',
})
const emit = defineEmits<PopconfirmEmits>()

const open = ref(false)

function confirm(): void {
  open.value = false
  emit('confirm')
}

function cancel(): void {
  open.value = false
  emit('cancel')
}
</script>
