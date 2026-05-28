<!-- SC_BlockHeader — styled.heading; v-html на нём безопасен. -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_BlockHeader :is="headerTag" :level="block.data.level || 1" v-html="formattedText" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockHeader } from './styled'

interface BlockHeaderData {
  level?: number
  text?: string
}

interface BlockHeaderBlock {
  type: string
  id: string
  data: BlockHeaderData
}

const props = defineProps<{
  block: BlockHeaderBlock
  index?: number
}>()

const headerTag = computed<string>(() => {
  const level = props.block.data.level || 1
  return `h${Math.min(Math.max(level, 1), 6)}`
})

const formattedText = computed<string>(() => {
  const text = props.block.data.text || ''
  let decoded: string
  try {
    decoded = decodeURIComponent(String(text))
  } catch {
    decoded = String(text)
  }
  return formatBastyonLinks(decoded)
})
</script>
