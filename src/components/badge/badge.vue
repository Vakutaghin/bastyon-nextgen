<template>
  <SC_Badge class="ui-badge">
    <slot />
    <sup v-if="text" class="ui-badge__count" :data-wide="text.length > 1 ? '' : undefined">{{
      text
    }}</sup>
  </SC_Badge>
</template>

<script setup lang="ts">
// Счётчик в углу значка (уведомления, события в шапке) вместо antd Badge.
// Цвет — `--ui-badge-color` (по умолчанию акцент), смещение от угла —
// `--ui-badge-offset-x` / `--ui-badge-offset-y`: их задаёт styled родителя.
import { computed } from 'vue'
import { badgeText } from './badge'
import type { BadgeProps } from './types'
import { SC_Badge } from './styled'

const p = withDefaults(defineProps<BadgeProps>(), { count: 0, max: 99 })

const text = computed(() => badgeText(p.count, p.max))
</script>
