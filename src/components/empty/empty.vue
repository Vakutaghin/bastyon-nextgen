<template>
  <SC_Empty>
    <SC_EmptyAvatar>
      <component :is="icon ?? InboxOutlined" />
    </SC_EmptyAvatar>
    <SC_EmptyTitle v-if="title">{{ title }}</SC_EmptyTitle>
    <SC_EmptyDescription v-if="description || $slots.description">
      <slot name="description">{{ description }}</slot>
    </SC_EmptyDescription>
  </SC_Empty>
</template>

<script setup lang="ts">
// Пустое состояние как UEmpty из Nuxt UI: иконка в круге, заголовок и подпись.
// Раньше здесь была иллюстрация antd Empty.
import { InboxOutlined } from '@/components/icons'
import { SC_Empty, SC_EmptyAvatar, SC_EmptyDescription, SC_EmptyTitle } from './styled'
import type { EmptyProps } from './types'

defineProps<EmptyProps>()
</script>
