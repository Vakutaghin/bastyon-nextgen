<template>
  <SC_Skeleton :w='w' :h='h' :br='br' />
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { SC_Skeleton } from './styled'

const p = withDefaults(
  defineProps<{
    /** Ширина: число (px) или CSS-строка (например, '100%'). */
    width?: number | string
    /** Высота: число (px) или CSS-строка. */
    height?: number | string
    /** Радиус скругления: число (px) или CSS-строка. По умолчанию 4px. */
    radius?: number | string
  }>(),
  {
    width: '100%',
    height: 16,
    radius: 4,
  },
)

function cssSize(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v
}

const w  = computed(() => cssSize(p.width))
const h  = computed(() => cssSize(p.height))
const br = computed(() => cssSize(p.radius))
</script>
