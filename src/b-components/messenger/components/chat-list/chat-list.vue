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

<script lang="ts">
import { chatListOptions } from './chat-list'

export default chatListOptions
</script>
