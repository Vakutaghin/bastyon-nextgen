<template>
  <SC_ChatList>
    <ChatListItem
      v-for="dialog in dialogs"
      :key="dialog.id"
      :dialog="dialog"
      @click="onSelect(dialog.id)"
    />
  </SC_ChatList>
</template>

<script setup lang="ts">
import type { Dialog } from '../../types'
import ChatListItem from '../chat-list-item/chat-list-item.vue'
import { SC_ChatList } from './styled'

defineProps<{ dialogs: Dialog[] }>()
const emit = defineEmits<{ select: [id: string] }>()

function onSelect(id: string): void {
  emit('select', id)
}
</script>
