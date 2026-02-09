<template>
  <SC_ButtonMore
    v-bind="buttonProps"
    :type="buttonProps.htmlType"
    :disabled="buttonProps.disabled"
    :class="buttonClass"
  >
    <SC_ButtonLoadingWrap v-if="loading">
      <img
        :src="loadingSpinnerIcon"
        alt=""
        width="14"
        height="14"
      />
    </SC_ButtonLoadingWrap>
    <slot />
  </SC_ButtonMore>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { useButton } from './button'
import type { ButtonProps } from './types'
import loadingSpinnerIcon from './img/loading-spinner.svg'
import { SC_ButtonLoadingWrap } from './styled'

const p = defineProps<ButtonProps>()

const { SC_ButtonMore, buttonProps, buttonClass } = useButton(p)

const loading = computed(() => p.loading)
</script>
