<template>
  <SC_BlockList
    :is='listTag'
    :style='listStyle'
  >
    <SC_BlockListItem
      v-for='(item, index) in listItems'
      :key='index'
      v-html='formatItem(item)'
    />
  </SC_BlockList>
</template>

<script>
import { blockListOptions } from './block-list.ts'

export default blockListOptions
</script>
