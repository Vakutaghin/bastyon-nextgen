<template>
  <SC_Select>
    <Select
      v-bind="{ ...$attrs, ...forwarded }"
      :popup-class-name="SELECT_POPUP_CLASS"
      :get-popup-container="selectPopupContainer"
      :menu-item-selected-icon="checkIcon"
    >
      <template #suffixIcon><CaretDownOutlined /></template>
    </Select>
  </SC_Select>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { CaretDownOutlined, CheckOutlined } from '@/components/icons'
import { SELECT_POPUP_CLASS, selectPopupContainer, useSelect } from './select'
import type { SelectProps } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<SelectProps>(), { disabled: undefined })

const { Select, SC_Select, forwarded } = useSelect(p)

// Галочка у выбранного пункта, как у USelect. Пропом, а не слотом: слота
// menuItemSelectedIcon antd работает, но в его типах нет.
const checkIcon = h(CheckOutlined)
</script>
