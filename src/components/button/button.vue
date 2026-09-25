<template>
  <SC_ButtonMore
    v-bind="buttonProps"
    :type="buttonProps.htmlType"
    :disabled="buttonProps.disabled"
    :class="buttonClass"
  >
    <SC_ButtonSpinner v-if="loading" aria-hidden="true" />
    <!-- Иконка — как у antd-кнопки: во время загрузки её место занимает спиннер.
         Раньше слот не рендерился, и иконки в кнопках пропадали. -->
    <slot v-else name="icon" />
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
