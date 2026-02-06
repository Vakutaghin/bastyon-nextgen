<template>
  <SC_MessageRow :class="isMine ? 'mine' : 'others'">
    <SC_MessageItem :class="isMine ? 'mine' : 'others'">
      <SC_MessageMeta v-if="showName">
        <span>{{ displayName }}</span>
      </SC_MessageMeta>

      <div v-if="message.type === 'audio'" class="message-audio">
        <AudioMessage :message="message" :compact="isCompact" />
        <div v-if="!message.url" style="font-size: 0.8em; color: red;">Audio URL missing</div>
      </div>

      <div v-else class="message-text" v-html="formattedText"></div>

      <SC_MessageTime>
        {{ formatTime(message.timestamp) }}
      </SC_MessageTime>
    </SC_MessageItem>
  </SC_MessageRow>
</template>

<script lang="ts">
import { messageItemOptions } from './message-item'

export default messageItemOptions
</script>
