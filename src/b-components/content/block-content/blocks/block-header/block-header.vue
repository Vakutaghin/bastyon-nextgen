<template>
  <SC_BlockHeader :is='headerTag' :level='block.data.level || 1' v-html='formattedText'></SC_BlockHeader>
</template>

<script>
import { blockHeaderOptions } from './block-header.ts'

export default blockHeaderOptions
</script>
