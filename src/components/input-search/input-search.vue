<template>
  <SC_InputSearch>
    <Input.Search
      v-bind="{ ...$attrs, ...forwarded }"
      :class="['bastyon-input-search', searchClass]"
      :enterButton="enterButtonValue"
    >
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
    </Input.Search>
  </SC_InputSearch>
</template>

<script setup lang="ts">
import { useInputSearch } from './input-search'
import type { InputSearchProps } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<InputSearchProps>(), {
  enterButton: undefined,
  disabled: undefined,
  allowClear: undefined,
  loading: undefined,
})

const { Input, SC_InputSearch, searchClass, enterButtonValue, forwarded } = useInputSearch(p)
</script>
