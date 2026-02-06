<template>
  <SC_BlockLink 
    :href='linkUrl' 
    :target='linkTarget'
    rel='noopener noreferrer'
  >
    {{ decodedText }}
  </SC_BlockLink>
</template>

<script>
import { blockLinkOptions } from './block-link.ts'

export default blockLinkOptions
</script>
