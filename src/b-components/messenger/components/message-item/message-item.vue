<template>
  <SC_MessageRow :class="isMine ? 'mine' : 'others'">
    <SC_AvatarSlot v-if="!isMine">
      <Avatar
        v-if="showAvatar"
        :src="displayAvatar"
        :alt="displayName"
        :fallbackText="displayName"
        :size="32"
        shape="circle"
      />
    </SC_AvatarSlot>

    <SC_MessageItem :class="isMine ? 'mine' : 'others'" style="position: relative">
      <SC_MessageMeta v-if="showName && !isMine">
        <span>{{ displayName }}</span>
      </SC_MessageMeta>

      <div v-if="message.type === 'audio'" class="message-audio">
        <AudioMessage :message="message" :compact="isCompact" />
        <div v-if="!message.url" style="font-size: 0.8em; color: red">Audio URL missing</div>
      </div>

      <div v-else-if="message.type === 'image'" class="message-image">
        <ImageMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'video'" class="message-video">
        <VideoMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'file'" class="message-file">
        <FileMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'transaction'" class="message-transaction">
        <TransactionMessage :message="message" />
      </div>

      <div v-else class="message-text">
        <template v-for="(seg, idx) in messageSegments" :key="idx">
          <span v-if="seg.kind === 'html'" v-html="seg.html"></span>
          <PostEmbed v-else :target="seg.target" />
        </template>
        <LinkPreview v-if="previewUrl" :url="previewUrl" />
      </div>

      <SC_MessageTime>
        {{ formatTime(message.timestamp) }}
        <SC_ReactionButton
          v-if="canReact"
          ref="reactionTriggerRef"
          type="button"
          title="Реакция"
          @click="toggleReactionPicker"
        >
          <span style="font-size: 14px">😀</span>
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
        <SC_ReactionPill v-for="r in message.reactions" :key="r.key" :class="{ mine: r.my }">
          {{ r.key }}
          <span v-if="r.count > 1" style="font-size: 10px; opacity: 0.8">{{ r.count }}</span>
        </SC_ReactionPill>
      </SC_ReactionsRow>
    </SC_MessageItem>
  </SC_MessageRow>
</template>

<script lang="ts">
import { messageItemOptions } from './message-item'

export default messageItemOptions
</script>
