<template>
  <li>
    <SC_Row ref="row" :class="{ active, draft: node.draft }">
      <SC_Toggle
        v-if="node.children.length"
        type="button"
        :class="{ open }"
        :aria-expanded="open"
        :aria-label="node.label"
        @click="tree.toggle(node.id)"
      >
        <RightOutlined />
      </SC_Toggle>
      <SC_ToggleSpacer v-else />
      <SC_RowLink
        :href="topicPath(node.id)"
        :aria-current="active ? 'page' : undefined"
        @click="choose"
      >
        <HelpBookIcon v-if="node.children.length" />
        <FileTextOutlined v-else />
        <span>{{ node.label }}</span>
      </SC_RowLink>
    </SC_Row>
    <SC_TreeChildren v-if="node.children.length && open">
      <HelpTocNode v-for="child in node.children" :key="child.id" :node="child" />
    </SC_TreeChildren>
  </li>
</template>

<script setup lang="ts">
// Пункт «Содержания»: книга (с подразделами) или страница. Нажатие на книгу
// открывает её статью и раскрывает её — как в CHM; стрелка только раскрывает.
// Черновики (видны только при разработке) приглушены.
import { computed, nextTick, ref, watch } from 'vue'
import { FileTextOutlined, HelpBookIcon, RightOutlined } from '@/components/icons'
import { topicPath } from '@/b-components/help/help-view'
import type { HelpTocNode as TocNode } from '@/helpers/help/help-types'
import { useHelpTree } from './help-tree'
import HelpTocNode from './help-toc-node.vue'
import {
  SC_Row,
  SC_RowLink,
  SC_Toggle,
  SC_ToggleSpacer,
  SC_TreeChildren,
} from '../help-page.styled'

const props = defineProps<{ node: TocNode }>()

const tree = useHelpTree()
const row = ref<{ $el?: HTMLElement } | null>(null)

const open = computed(() => tree.expanded.value.has(props.node.id))
const active = computed(() => tree.current.value === props.node.id)

function choose(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (props.node.children.length) tree.expand(props.node.id)
  tree.open(props.node.id)
}

// Открытая статья всегда видна в оглавлении (синхронизация, как в CHM).
watch(
  active,
  async (now) => {
    if (!now) return
    await nextTick()
    row.value?.$el?.scrollIntoView?.({ block: 'nearest' })
  },
  { immediate: true }
)
</script>
