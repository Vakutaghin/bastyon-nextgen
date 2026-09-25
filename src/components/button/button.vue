<template>
  <SC_ButtonMore
    v-bind="buttonProps"
    :type="buttonProps.htmlType"
    :disabled="buttonProps.disabled"
    :class="buttonClass"
  >
    <SC_ButtonSpinner v-if="loading" aria-hidden="true" />
    <slot />
  </SC_ButtonMore>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useButton } from './button'
import type { ButtonProps } from './types'
import { SC_ButtonSpinner } from './styled'

const p = defineProps<ButtonProps>()

const { SC_ButtonMore, buttonProps, buttonClass } = useButton(p)

const loading = computed(() => p.loading)
</script>
