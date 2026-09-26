<template>
  <SC_Tabs role="tablist" :aria-label="t('help.title')">
    <SC_Tab
      v-for="tab in TABS"
      :key="tab"
      type="button"
      role="tab"
      :class="{ active: page.tab.value === tab }"
      :aria-selected="page.tab.value === tab"
      :aria-label="t(`help.tabs.${tab}`)"
      :title="t(`help.tabs.${tab}`)"
      @click="page.tab.value = tab"
    >
      <HelpContentsIcon v-if="tab === 'contents'" />
      <HelpIndexIcon v-else-if="tab === 'index'" />
      <SearchOutlined v-else-if="tab === 'search'" />
      <StarOutlined v-else />
      <span class="tab-label">{{ t(`help.tabs.${tab}`) }}</span>
    </SC_Tab>
  </SC_Tabs>
  <SC_Pane role="tabpanel">
    <SC_List v-if="page.tab.value === 'contents'">
      <HelpTocNode v-for="node in toc" :key="node.id" :node="node" />
    </SC_List>
    <HelpIndexPane v-else-if="page.tab.value === 'index'" />
    <HelpSearchPane v-else-if="page.tab.value === 'search'" />
    <HelpFavoritesPane v-else />
  </SC_Pane>
</template>

<script setup lang="ts">
// Навигатор справки — левая панель окна CHM: «Содержание», «Указатель»,
// «Поиск», «Избранное».
import { computed, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { HelpContentsIcon, HelpIndexIcon, SearchOutlined, StarOutlined } from '@/components/icons'
import type { HelpTocNode as TocNode } from '@/helpers/help/help-types'
import type { HelpTab } from '../use-help-page'
import { useHelpPageContext } from '../use-help-page'
import { SC_List, SC_Pane, SC_Tab, SC_Tabs } from '../help-page.styled'
import HelpFavoritesPane from './help-favorites-pane.vue'
import HelpIndexPane from './help-index-pane.vue'
import HelpSearchPane from './help-search-pane.vue'
import HelpTocNode from './help-toc-node.vue'
import { HELP_TREE } from './help-tree'

const TABS: HelpTab[] = ['contents', 'index', 'search', 'favorites']

const { t } = useI18n()
const page = useHelpPageContext()

const toc = computed(() => page.library.value?.toc ?? [])
const expanded = ref<ReadonlySet<string>>(new Set())

function isBook(nodes: readonly TocNode[], id: string): boolean {
  return nodes.some((node) =>
    node.id === id ? node.children.length > 0 : isBook(node.children, id)
  )
}

function expand(id: string): void {
  if (!expanded.value.has(id)) expanded.value = new Set([...expanded.value, id])
}

function toggle(id: string): void {
  const next = new Set(expanded.value)
  if (!next.delete(id)) next.add(id)
  expanded.value = next
}

// Открытая статья раскрывает книги, в которых лежит.
watch(
  () => [page.topicId.value, page.library.value] as const,
  ([id, library]) => {
    if (!id || !library) return
    const books = [...(library.trail.get(id) ?? [])]
    if (isBook(library.toc, id)) books.push(id)
    if (books.some((book) => !expanded.value.has(book))) {
      expanded.value = new Set([...expanded.value, ...books])
    }
  },
  { immediate: true }
)

provide(HELP_TREE, {
  expanded,
  current: computed(() => page.topicId.value),
  toggle,
  expand,
  open: (id: string) => page.openTopic(id),
})
</script>
