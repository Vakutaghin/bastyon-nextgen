<template>
  <SC_MessengerButton
    :is-open="isOpen"
    :aria-label="t('messenger.messages')"
    :aria-expanded="isOpen"
    @click="emit('click')"
  >
    <slot name="icon" />
    <SC_UnreadBadge v-if="unreadCount > 0">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </SC_UnreadBadge>
  </SC_MessengerButton>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SC_MessengerButton, SC_UnreadBadge } from './styled'

const { t } = useI18n()

withDefaults(defineProps<{ unreadCount?: number; isOpen?: boolean }>(), {
  unreadCount: 0,
  isOpen: false,
})

const emit = defineEmits<{ click: [] }>()
</script>
