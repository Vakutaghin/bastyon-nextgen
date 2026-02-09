<template>
  <SC_MessageList ref="listRef" @scroll="handleScroll">
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id"
      :message="message"
      :showName="shouldShowName(index)"
    />
  </SC_MessageList>
</template>

<script lang="ts">
import { messageListOptions } from './message-list'
import { SC_MessageList } from './styled'

export default {
  ...messageListOptions,
  components: {
    ...messageListOptions.components,
    SC_MessageList,
  },
}
</script>
