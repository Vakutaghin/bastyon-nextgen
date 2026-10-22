<template>
  <SC_Avatar
    ref="rootEl"
    :shape="shape"
    :style="{
      color: textColor,
    }"
  >
    <template v-if="actualSrc && !showPlaceholder">
      <img
        :src="actualSrc"
        :alt="alt"
        crossorigin="anonymous"
        :style="{
          width: sizePx + 'px',
          height: sizePx + 'px',
          borderRadius: borderRadius,
          objectFit: 'cover',
        }"
        @error="handleImageError"
        @load="handleImageLoad"
      />
    </template>

    <template v-else-if="isHeaderAvatar && (!src || showPlaceholder)">
      <div
        :style="{
          width: sizePx + 'px',
          height: sizePx + 'px',
          borderRadius: borderRadius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fallbackColor,
          color: textColor,
          fontWeight: 500,
          fontSize: Math.max(12, sizePx * 0.4) + 'px',
        }"
      >
        {{ getInitials() }}
      </div>
    </template>

    <Avatar
      v-else
      v-bind="$attrs"
      :size="size"
      :src="actualSrc && !showPlaceholder ? actualSrc : undefined"
      :class="['bastyon-avatar', avatarClass]"
      :style="{
        backgroundColor: !src || showPlaceholder ? fallbackColor : undefined,
        color: !src || showPlaceholder ? textColor : undefined,
        marginRight: 0,
      }"
      @error="handleImageError"
      @load="handleImageLoad"
    >
      <slot>
        <template v-if="!actualSrc || showPlaceholder">
          {{ getInitials() }}
        </template>
      </slot>
    </Avatar>
    <div
      v-if="p.pending"
      class="pending-badge"
      :style="{
        width: Math.max(14, Math.floor(sizePx * 0.35)) + 'px',
        height: Math.max(14, Math.floor(sizePx * 0.35)) + 'px',
      }"
    >
      <ClockCircleOutlined :style="ICON_WHITE_9" />
    </div>
    <UserMarkBadge v-else-if="mark" :mark="mark" :size="Math.max(14, Math.floor(sizePx * 0.35))" />
  </SC_Avatar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAvatar } from './avatar'
import type { AvatarProps } from './types'
import { ClockCircleOutlined } from '@/components/icons'
import { UserMarkBadge } from '@/components/user-mark'
import type { UserMark } from '@/helpers/profile/user-mark'
import { ICON_WHITE_9 } from '@/styles/icon-styles'

const p = withDefaults(defineProps<AvatarProps>(), {
  verified: false,
  pending: false,
  mark: null,
})

/** Значок у аватара; `verified` — старый проп, то же, что mark="verified". */
const mark = computed<UserMark | null>(() => p.mark ?? (p.verified ? 'verified' : null))

const {
  Avatar,
  SC_Avatar,
  showPlaceholder,
  isHeaderAvatar,
  avatarClass,
  sizePx,
  borderRadius,
  getInitials,
  fallbackColor,
  textColor,
  handleImageError,
  handleImageLoad,
  actualSrc,
} = useAvatar(p)
</script>
