<template>
  <SC_Select>
    <Select
      v-bind="{ ...$attrs, ...forwarded }"
      :popup-class-name="SELECT_POPUP_CLASS"
      :get-popup-container="popupContainer"
      :menu-item-selected-icon="checkIcon"
      transition-name=""
    >
      <template #suffixIcon><CaretDownOutlined class="ant-select-suffix" /></template>
    </Select>
  </SC_Select>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { CaretDownOutlined, CheckOutlined } from '@/components/icons'
import { popupContainer } from '../popup-container'
import { SELECT_POPUP_CLASS, useSelect } from './select'
import type { SelectProps } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<SelectProps>(), { disabled: undefined })

const { Select, SC_Select, forwarded } = useSelect(p)

// Список открывается сразу, без «slide-up» antd: с ним пункты проступали из
// прозрачности только через ~0,2 с после нажатия (transition-name="").
// Своя стрелка — с классом ant-select-suffix, как стандартная: иначе antd
// делает её кликабельной (pointer-events: auto), а лежит она вне поля, и
// нажатие на неё список не открывало.
// Галочка у выбранного пункта, как у USelect. Пропом, а не слотом: слота
// menuItemSelectedIcon antd работает, но в его типах нет.
const checkIcon = h(CheckOutlined)
</script>
