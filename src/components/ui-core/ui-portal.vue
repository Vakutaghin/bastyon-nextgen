<template>
  <Teleport :to="target" :disabled="disabled">
    <slot />
  </Teleport>
</template>

<script setup lang="ts">
// Содержимое — в `#ui-layers` в конце body: окна и панели не обрезаются
// overflow родителей и не зависят от их слоёв.
import { layerRoot } from './layer-root'

defineProps<{
  /** Рисовать на месте, без телепорта. */
  disabled?: boolean
}>()

const target = layerRoot()
</script>
