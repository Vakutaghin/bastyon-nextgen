<template>
  <!-- Квадратная аватарка и мегафон: канал не спутать с человеком и группой (у них круг). -->
  <SC_ChannelAvatar :size="size">
    <Avatar
      :src="src"
      :alt="name"
      :fallback-text="name"
      :size="size"
      :verified="verified"
      :mark="mark"
      shape="square"
    />
    <SC_ChannelBadge v-if="badge" :size="size" aria-hidden="true">
      <MegaphoneIcon />
    </SC_ChannelBadge>
  </SC_ChannelAvatar>
</template>

<script setup lang="ts">
import Avatar from '@/components/avatar/avatar.vue'
import { MegaphoneIcon } from '@/components/icons'
import type { UserMark } from '@/helpers/profile/user-mark'
import { SC_ChannelAvatar, SC_ChannelBadge } from './styled'

withDefaults(
  defineProps<{
    src?: string
    name: string
    size: number
    verified?: boolean
    mark?: UserMark | null
    /** Мегафон в углу — в списке чатов. */
    badge?: boolean
  }>(),
  { src: undefined, verified: false, mark: null, badge: false }
)
</script>
