<template>
  <SC_InputSearch>
    <Input.Search
      v-bind='$attrs'
      :class="['bastyon-input-search', searchClass]"
      :enterButton="enterButtonValue"
    >
      <template #suffix>
        <slot name='suffix' />
      </template>
    </Input.Search>
  </SC_InputSearch>
</template>

<script setup lang='ts'>
import { useInputSearch } from './input-search'
import type { InputSearchProps } from './types'

const p = withDefaults(defineProps<InputSearchProps>(), {
  enterButton: undefined
})

const { Input, SC_InputSearch, searchClass, enterButtonValue } = useInputSearch(p)
</script>
