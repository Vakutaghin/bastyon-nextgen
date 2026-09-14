<!-- SC_BlockParagraph — styled.p; v-html на нём безопасен. -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_BlockParagraph v-html="formattedText" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockParagraph } from './styled'
import { safeDecode } from '@/helpers/content/safe-decode'

interface BlockParagraphData {
  text?: string
}

interface BlockParagraphBlock {
  type: string
  id: string
  data: BlockParagraphData
}

const props = defineProps<{
  block: BlockParagraphBlock
  index?: number
}>()

const formattedText = computed<string>(() => {
  const text = props.block.data.text || ''
  const decoded = safeDecode(String(text))
  const withBreaks = decoded.replace(/\n/g, '<br>').replace(/\r\n/g, '<br>')
  return formatBastyonLinks(withBreaks)
})
</script>
