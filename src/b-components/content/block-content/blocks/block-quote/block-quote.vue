<!-- SC_BlockQuoteContent — styled.div; v-html на нём безопасен. -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_BlockQuote>
    <SC_BlockQuoteContent v-html="formattedText" />
    <SC_BlockQuoteCaption v-if="caption">
      {{ decodedCaption }}
    </SC_BlockQuoteCaption>
  </SC_BlockQuote>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockQuote, SC_BlockQuoteContent, SC_BlockQuoteCaption } from './styled'

interface BlockQuoteData {
  text?: string
  quote?: string
  caption?: string
  captionText?: string
}

interface BlockQuoteBlock {
  type: string
  id: string
  data: BlockQuoteData
}

const props = defineProps<{
  block: BlockQuoteBlock
  index?: number
}>()

const text = computed<string>(() => props.block.data.text || props.block.data.quote || '')
const caption = computed<string>(
  () => props.block.data.caption || props.block.data.captionText || ''
)
const decodedCaption = computed<string>(() => {
  try {
    return decodeURIComponent(String(caption.value))
  } catch {
    return String(caption.value)
  }
})
const formattedText = computed<string>(() => {
  let decoded: string
  try {
    decoded = decodeURIComponent(String(text.value))
  } catch {
    decoded = String(text.value)
  }
  return formatBastyonLinks(decoded.replace(/\n/g, '<br>'))
})
</script>
