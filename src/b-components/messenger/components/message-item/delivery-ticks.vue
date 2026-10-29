<template>
  <!-- Галочки рисуем, а не символом «✓✓»: у шрифтов между двумя «✓» разный и
       большой зазор. Как в Telegram, вторая заходит на первую — её короткий
       штрих начинается от длинного штриха первой. -->
  <span v-if="mark === '…'">…</span>
  <svg
    v-else
    :viewBox="double ? '0 0 15 11' : '0 0 11 11'"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M1 5.75 4 8.75 10 2.25" />
    <path v-if="double" d="M5.92 6.67 8 8.75 14 2.25" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** «…», «✓» или «✓✓» — из deliveryMark. */
const props = defineProps<{ mark: string }>()

const double = computed(() => props.mark === '✓✓')
</script>
