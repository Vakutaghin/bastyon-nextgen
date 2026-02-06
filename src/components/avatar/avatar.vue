<template>
  <SC_Avatar
    ref="rootEl"
    :shape="shape"
    :style="{
      backgroundColor: fallbackColor,
      color: textColor
    }"
  >
    <template v-if="actualSrc && !showPlaceholder">
      <img
        :src="actualSrc"
        :alt="alt"
        crossorigin="anonymous"
        :style="{ width: sizePx + 'px', height: sizePx + 'px', borderRadius: borderRadius, objectFit: 'cover' }"
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
          fontWeight: 600,
          fontSize: Math.max(12, sizePx * 0.4) + 'px'
        }"
      >
        {{ getInitials() }}
      </div>
    </template>

    <Avatar
      v-else
      v-bind='$attrs'
      :size='size'
      :src='actualSrc && !showPlaceholder ? actualSrc : undefined'
      :class="['bastyon-avatar', avatarClass]"
      :style="{
        backgroundColor: (!src || showPlaceholder) ? fallbackColor : undefined,
        color: (!src || showPlaceholder) ? textColor : undefined,
        marginRight: 0,
      }"
      @error='handleImageError'
      @load='handleImageLoad'
    >
      <slot>
        <template v-if='!actualSrc || showPlaceholder'>
          {{ getInitials() }}
        </template>
      </slot>
    </Avatar>
    <div
      v-if="p.verified"
      class="verified-badge"
      :style="{
        width: Math.max(14, Math.floor(sizePx * 0.35)) + 'px',
        height: Math.max(14, Math.floor(sizePx * 0.35)) + 'px'
      }"
    >
      <CheckOutlined style="color: #fff; font-size: 10px;" />
    </div>
  </SC_Avatar>
</template>

<script setup lang='ts'>
import { useAvatar } from './avatar'
import type { AvatarProps } from './types'
import { CheckOutlined } from '@ant-design/icons-vue'

const p = withDefaults(defineProps<AvatarProps>(), {
  verified: false
})

const {
  Avatar,
  SC_Avatar,
  attrs,
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
  rootEl
} = useAvatar(p)
</script>
