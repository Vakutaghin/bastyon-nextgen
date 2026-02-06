<template>
  <SC_Card>
    <Card v-bind='$attrs' :class="['bastyon-card', cardClass]">
      <template #title>
        <slot name='title' />
      </template>
      <template #extra>
        <slot name='extra' />
      </template>
      <template #actions>
        <slot name='actions' />
      </template>
      <slot />
    </Card>
  </SC_Card>
</template>

<script setup lang='ts'>
import { useCard } from './card'
import type { CardProps } from './types'

const p = defineProps<CardProps>()

const { Card, SC_Card, cardClass } = useCard(p)
</script>
