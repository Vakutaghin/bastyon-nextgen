<template>
  <SC_Card>
    <Card v-bind="{ ...$attrs, ...forwarded }" :class="['bastyon-card', cardClass]">
      <template v-if="$slots.title" #title>
        <slot name="title" />
      </template>
      <template v-if="$slots.extra" #extra>
        <slot name="extra" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
      <slot />
    </Card>
  </SC_Card>
</template>

<script setup lang="ts">
import { useCard } from './card'
import type { CardProps } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<CardProps>(), {
  bordered: undefined,
  hoverable: undefined,
  loading: undefined,
  extra: undefined,
})

const { Card, SC_Card, cardClass, forwarded } = useCard(p)
</script>
