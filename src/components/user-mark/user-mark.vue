<template>
  <SC_UserMarkAnchor>
    <slot />
    <UserMarkBadge v-if="mark" :mark="mark" :size="size" />
  </SC_UserMarkAnchor>
</template>

<script setup lang="ts">
// Аватар (слот) со значком, как markUser старого приложения. Для аватаров на
// обычном <img>; у компонента Avatar значок свой — проп `mark`.
import type { UserMark } from '@/helpers/profile/user-mark'
import UserMarkBadge from './user-mark-badge.vue'
import { SC_UserMarkAnchor } from './styled'

withDefaults(
  defineProps<{
    mark: UserMark | null | undefined
    /** Диаметр значка, px. */
    size?: number
  }>(),
  { size: 16 }
)
</script>
