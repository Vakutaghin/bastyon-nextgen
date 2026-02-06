<template>
  <SC_Empty>
    <Empty v-bind='$attrs' :class="['bastyon-empty', emptyClass]">
      <template #description>
        <slot name='description'>
          {{ description }}
        </slot>
      </template>
      <template #image>
        <slot name='image' />
      </template>
    </Empty>
  </SC_Empty>
</template>

<script setup lang='ts'>
import { useEmpty } from './empty'
import type { EmptyProps } from './types'

const p = defineProps<EmptyProps>()

const { Empty, SC_Empty, emptyClass } = useEmpty(p)
</script>
