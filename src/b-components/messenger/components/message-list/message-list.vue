<template>
  <div class="message-list-container" ref="listRef" @scroll="handleScroll">
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id"
      :message="message"
      :showName="shouldShowName(index)"
    />
  </div>
</template>

<style scoped>
.message-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

<script lang="ts">
import { messageListOptions } from './message-list'

export default messageListOptions
</script>
