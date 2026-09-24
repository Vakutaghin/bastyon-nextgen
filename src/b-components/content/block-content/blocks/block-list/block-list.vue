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
import { safeDecode } from '@/helpers/content/safe-decode'
import { normalizeListItems } from '@/helpers/content/editorjs-blocks'

interface BlockListData {
  style?: 'ordered' | 'unordered'
  /** Строки (Editor.js v1) либо объекты `{content, items}` (v2). */
  items?: unknown
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
// Объекты v2 без нормализации превращались в `[object Object]` (S25).
const listItems = computed<string[]>(() => normalizeListItems(props.block.data.items))

function formatItem(item: string): string {
  const decoded = safeDecode(String(item))
  return formatBastyonLinks(decoded.replace(/\n/g, '<br>'))
}
</script>
