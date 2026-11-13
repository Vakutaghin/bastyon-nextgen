<template>
  <Teleport :to="target" :disabled="disabled">
    <slot />
  </Teleport>
</template>

<script setup lang="ts">
// Содержимое — в `#ui-layers` в конце body: окна и панели не обрезаются
// overflow родителей и не зависят от их слоёв. Корень каждого слоя ставит
// `data-popup-host`, чтобы панели antd внутри него (список Select в своём
// окне) рисовались в нём, а не в body под окном (см. popup-container.ts).
import { layerRoot } from './layer-root'

defineProps<{
  /** Рисовать на месте, без телепорта. */
  disabled?: boolean
}>()

const target = layerRoot()
</script>
