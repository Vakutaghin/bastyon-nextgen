<template>
  <SC_EmojiGridPanel>
    <SC_EmojiCellBtn
      v-for="emoji in COMMON_EMOJIS"
      :key="emoji"
      type="button"
      @click.stop.prevent="emit('select', emoji)"
    >
      {{ emoji }}
    </SC_EmojiCellBtn>
  </SC_EmojiGridPanel>
</template>

<script setup lang="ts">
// Popover-дружелюбный пикер эмодзи для формы комментария.
// Переиспользует общий список COMMON_EMOJIS (тот же, что и в мессенджере),
// но без абсолютного позиционирования — рендерится внутри APopover.
import { COMMON_EMOJIS } from '@/helpers/common/emoji-list'
import { SC_EmojiGridPanel, SC_EmojiCellBtn } from './styled'

const emit = defineEmits<{
  select: [emoji: string]
}>()
</script>
