<template>
  <SC_Window :is-open="isOpen">
    <SC_Header>
      <slot name="actions" />
      <SC_Title>{{ title }}</SC_Title>
      <button
        type="button"
        :aria-label="t('chat.close')"
        :style="{
          appearance: 'none',
          border: 'none',
          padding: 0,
          background: 'transparent',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '8px',
        }"
        @click="emit('close')"
      >
        <img :src="closeIcon" alt="" width="12" height="12" />
      </button>
    </SC_Header>

    <SC_Content>
      <slot />
    </SC_Content>
  </SC_Window>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SC_Window, SC_Header, SC_Title, SC_Content } from './styled'
import closeIcon from './img/close.svg'

const { t } = useI18n()

withDefaults(defineProps<{ isOpen: boolean; title?: string }>(), { title: 'Messenger' })
const emit = defineEmits<{ close: [] }>()
</script>
