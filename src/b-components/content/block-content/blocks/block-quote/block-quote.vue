<template>
  <SC_BlockQuote>
    <SC_BlockQuoteContent v-html='formattedText'></SC_BlockQuoteContent>
    <SC_BlockQuoteCaption v-if='caption'>
      {{ decodedCaption }}
    </SC_BlockQuoteCaption>
  </SC_BlockQuote>
</template>

<script>
import { blockQuoteOptions } from './block-quote.ts'

export default blockQuoteOptions
</script>
