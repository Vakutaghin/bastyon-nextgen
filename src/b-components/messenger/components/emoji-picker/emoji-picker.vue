<template>
  <SC_EmojiPickerContainer>
    <SC_EmojiHeader>Эмодзи</SC_EmojiHeader>
    <SC_EmojiGrid>
      <SC_EmojiButton
        v-for="emoji in commonEmojis"
        :key="emoji"
        @click="handleSelect(emoji)"
      >
        {{ emoji }}
      </SC_EmojiButton>
    </SC_EmojiGrid>
  </SC_EmojiPickerContainer>
</template>

<script lang="ts">
import { emojiPickerOptions } from './emoji-picker'

export default emojiPickerOptions
</script>
