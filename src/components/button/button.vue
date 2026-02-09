<template>
  <SC_ButtonMore
    v-bind="buttonProps"
    :type="buttonProps.htmlType"
    :disabled="buttonProps.disabled"
    :class="buttonClass"
  >
    <span v-if="loading" style="margin-right: 8px;">
      <img
        :src="loadingSpinnerIcon"
        alt=""
        width="14"
        height="14"
        style="animation: spin 1s linear infinite;"
      />
    </span>
    <slot />
  </SC_ButtonMore>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { useButton } from './button'
import type { ButtonProps } from './types'
import loadingSpinnerIcon from './img/loading-spinner.svg'

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
