<template>
  <SC_MessageRow :class="isMine ? 'mine' : 'others'">
    <SC_MessageItem :class="isMine ? 'mine' : 'others'" style="position: relative;">
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
        <SC_ReactionButton
          v-if="canReact"
          ref="reactionTriggerRef"
          type="button"
          title="Реакция"
          @click="toggleReactionPicker"
        >
          <span style="font-size: 14px;">😀</span>
        </SC_ReactionButton>
      </SC_MessageTime>

      <Teleport to="body">
        <SC_ReactionPicker
          v-if="showReactionPicker"
          ref="reactionPickerRef"
          class="reaction-picker"
          :style="pickerStyle || undefined"
        >
          <SC_ReactionPickerEmoji
            v-for="emoji in quickReactionEmojis"
            :key="emoji"
            type="button"
            @click="onReactionClick(emoji)"
          >
            {{ emoji }}
          </SC_ReactionPickerEmoji>
        </SC_ReactionPicker>
      </Teleport>

      <SC_ReactionsRow v-if="message.reactions?.length">
        <SC_ReactionPill
          v-for="r in message.reactions"
          :key="r.key"
          :class="{ mine: r.my }"
        >
          {{ r.key }}
          <span v-if="r.count > 1" style="font-size: 10px; opacity: 0.8;">{{ r.count }}</span>
        </SC_ReactionPill>
      </SC_ReactionsRow>
    </SC_MessageItem>
  </SC_MessageRow>
</template>

<script lang="ts">
import { messageItemOptions } from './message-item'

export default messageItemOptions
</script>
