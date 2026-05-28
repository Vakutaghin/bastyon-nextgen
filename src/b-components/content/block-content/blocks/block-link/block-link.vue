<template>
  <SC_BlockLink :href="linkUrl" :target="linkTarget" rel="noopener noreferrer">
    {{ decodedText }}
  </SC_BlockLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_BlockLink } from './styled'

interface BlockLinkData {
  url?: string
  href?: string
  text?: string
  link?: string
  target?: string
}

interface BlockLinkBlock {
  type: string
  id: string
  data: BlockLinkData
}

const props = defineProps<{
  block: BlockLinkBlock
  index?: number
}>()

const linkUrl = computed<string>(() => props.block.data.url || props.block.data.href || '#')
const linkText = computed<string>(
  () => props.block.data.text || props.block.data.link || linkUrl.value
)
const decodedText = computed<string>(() => {
  try {
    return decodeURIComponent(String(linkText.value))
  } catch {
    return String(linkText.value)
  }
})
const linkTarget = computed<string>(() => props.block.data.target || '_blank')
</script>
