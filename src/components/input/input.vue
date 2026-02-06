<template>
  <SC_Input>
    <Input v-bind='$attrs' :class="['bastyon-input', inputClass]">
      <slot />
    </Input>
  </SC_Input>
</template>

<script setup lang='ts'>
import { useInput } from './input'
import type { InputProps } from './types'

const p = defineProps<InputProps>()

const { Input, SC_Input, inputClass } = useInput(p)
</script>
