<template>
  <SC_Window :is-open="isOpen">
    <SC_Header>
      <slot name="actions" />
      <SC_Title>{{ title }}</SC_Title>
      <SC_CloseButton type="button" :aria-label="t('chat.close')" @click="emit('close')">
        <img :src="closeIcon" alt="" width="12" height="12" />
      </SC_CloseButton>
    </SC_Header>

    <SC_Content>
      <slot />
    </SC_Content>
  </SC_Window>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SC_Window, SC_Header, SC_Title, SC_Content, SC_CloseButton } from './styled'
import closeIcon from './img/close.svg'

const { t } = useI18n()

withDefaults(defineProps<{ isOpen: boolean; title?: string }>(), { title: 'Messenger' })
const emit = defineEmits<{ close: [] }>()
</script>
