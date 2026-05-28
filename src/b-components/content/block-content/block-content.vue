<template>
  <SC_BlockContent>
    <component
      v-for="(block, idx) in parsedBlocks"
      :key="block.id || idx"
      :is="getBlockComponent(block.type)"
      :block="block"
      :index="idx"
    />
  </SC_BlockContent>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import BlockHeader from './blocks/block-header/block-header.vue'
import BlockParagraph from './blocks/block-paragraph/block-paragraph.vue'
import BlockList from './blocks/block-list/block-list.vue'
import BlockQuote from './blocks/block-quote/block-quote.vue'
import BlockCode from './blocks/block-code/block-code.vue'
import BlockImage from './blocks/block-image/block-image.vue'
import BlockLink from './blocks/block-link/block-link.vue'
import BlockTable from './blocks/block-table/block-table.vue'
import { SC_BlockContent } from './styled'

export interface BlockContentBlock {
  type: string
  id: string
  data: Record<string, unknown>
}

const props = defineProps<{
  content?: string | object | null
}>()

const parsedBlocks = computed<BlockContentBlock[]>(() => {
  if (!props.content) return []
  try {
    const parsed = typeof props.content === 'string' ? JSON.parse(props.content) : props.content
    if (parsed && Array.isArray(parsed.blocks)) return parsed.blocks as BlockContentBlock[]
    if (Array.isArray(parsed)) return parsed as BlockContentBlock[]
    return []
  } catch {
    return []
  }
})

const COMPONENT_MAP: Record<string, Component> = {
  header: BlockHeader,
  paragraph: BlockParagraph,
  list: BlockList,
  quote: BlockQuote,
  code: BlockCode,
  image: BlockImage,
  link: BlockLink,
  table: BlockTable,
}

function getBlockComponent(type: string): Component {
  return COMPONENT_MAP[type] || BlockParagraph
}
</script>
