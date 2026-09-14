<template>
  <SC_Input>
    <Input v-bind="{ ...$attrs, ...forwarded }" :class="['bastyon-input', inputClass]">
      <slot />
    </Input>
  </SC_Input>
</template>

<script setup lang="ts">
import { useInput } from './input'
import type { InputProps } from './types'

defineOptions({ inheritAttrs: false })

// VNodeChild-пропсы Vue тоже кастует в false при отсутствии (в типе есть boolean) — default undefined.
const p = withDefaults(defineProps<InputProps>(), {
  disabled: undefined,
  allowClear: undefined,
  prefix: undefined,
  suffix: undefined,
  addonBefore: undefined,
  addonAfter: undefined,
})

const { Input, SC_Input, inputClass, forwarded } = useInput(p)
</script>
