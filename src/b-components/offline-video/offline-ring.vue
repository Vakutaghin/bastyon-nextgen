<template>
  <SC_Ring viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true">
    <circle class="track" cx="10" cy="10" :r="R" fill="none" stroke-width="2.5" />
    <circle
      class="bar"
      cx="10"
      cy="10"
      :r="R"
      fill="none"
      stroke-width="2.5"
      stroke-linecap="round"
      :stroke-dasharray="C"
      :stroke-dashoffset="offset"
      transform="rotate(-90 10 10)"
    />
  </SC_Ring>
</template>

<script setup lang="ts">
// Кольцо хода загрузки, как у кнопки «Скачать» YouTube. Доля 0…1; без доли
// (размер ещё не известен) — короткая дуга.

import { computed } from 'vue'
import { SC_Ring } from './offline-video.styled'

const props = defineProps<{ value: number | null }>()

const R = 8
const C = 2 * Math.PI * R
const offset = computed(() => {
  const v = props.value === null ? 0.08 : Math.min(1, Math.max(0, props.value))
  return C * (1 - v)
})
</script>
