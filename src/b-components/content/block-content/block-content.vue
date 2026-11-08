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
import { computed, provide, type Component } from 'vue'
import { useModalStore } from '@/stores/modal-store'
import { OPEN_ARTICLE_IMAGE, articleImageUrl, type ArticleImageData } from './article-images'
import BlockHeader from './blocks/block-header/block-header.vue'
import BlockParagraph from './blocks/block-paragraph/block-paragraph.vue'
import BlockList from './blocks/block-list/block-list.vue'
import BlockQuote from './blocks/block-quote/block-quote.vue'
import BlockCode from './blocks/block-code/block-code.vue'
import BlockImage from './blocks/block-image/block-image.vue'
import BlockLink from './blocks/block-link/block-link.vue'
import BlockTable from './blocks/block-table/block-table.vue'
import BlockDelimiter from './blocks/block-delimiter/block-delimiter.vue'
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

// Картинки статьи — в просмотрщике, все по порядку (article-images.ts).
const modalStore = useModalStore()
const imageUrls = computed<string[]>(() =>
  parsedBlocks.value
    .filter((block) => block.type === 'image')
    .map((block) => articleImageUrl(block.data as ArticleImageData))
    .filter(Boolean)
)
provide(OPEN_ARTICLE_IMAGE, (url: string) => {
  const list = imageUrls.value
  if (!list.length) return
  modalStore.openImageGallery(list, Math.max(0, list.indexOf(url)))
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
  // Раньше delimiter падал в BlockParagraph и рисовался пустым абзацем (S25).
  delimiter: BlockDelimiter,
}

function getBlockComponent(type: string): Component {
  return COMPONENT_MAP[type] || BlockParagraph
}
</script>
