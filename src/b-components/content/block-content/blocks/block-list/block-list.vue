<!-- SC_BlockListItem — styled.li; v-html на нём безопасен. -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_BlockList :is="listTag" :style="listStyle">
    <SC_BlockListItem v-for="(item, index) in listItems" :key="index" v-html="formatItem(item)" />
  </SC_BlockList>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockList, SC_BlockListItem } from './styled'

interface BlockListData {
  style?: 'ordered' | 'unordered'
  items?: string[]
}

interface BlockListBlock {
  type: string
  id: string
  data: BlockListData
}

const props = defineProps<{
  block: BlockListBlock
  index?: number
}>()

const listStyle = computed<string>(() => props.block.data.style || 'unordered')
const listTag = computed<string>(() => (listStyle.value === 'ordered' ? 'ol' : 'ul'))
const listItems = computed<string[]>(() => {
  const items = props.block.data.items
  return Array.isArray(items) ? items : []
})

function formatItem(item: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(String(item))
  } catch {
    decoded = String(item)
  }
  return formatBastyonLinks(decoded.replace(/\n/g, '<br>'))
}
</script>
