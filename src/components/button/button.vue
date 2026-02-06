<template>
  <SC_ButtonMore
    v-bind="buttonProps"
    :type="buttonProps.htmlType"
    :disabled="buttonProps.disabled"
    :class="buttonClass"
  >
    <span v-if="loading" style="margin-right: 8px;">
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style="animation: spin 1s linear infinite;"
      >
        <circle
          cx="7"
          cy="7"
          r="6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray="31.416"
          stroke-dashoffset="23.562"
          stroke-linecap="round"
        />
      </svg>
    </span>
    <slot />
  </SC_ButtonMore>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { useButton } from './button'
import type { ButtonProps } from './types'

const p = defineProps<ButtonProps>()

const { SC_ButtonMore, buttonProps, buttonClass } = useButton(p)

const loading = computed(() => p.loading)
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
