<template>
  <SC_BlockContent>
    <component
      v-for='(block, index) in parsedBlocks'
      :key='block.id || index'
      :is='getBlockComponent(block.type)'
      :block='block'
      :index='index'
    />
  </SC_BlockContent>
</template>

<script>
import { blockContentOptions } from './block-content.ts'

export default blockContentOptions
</script>
