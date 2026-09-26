<template>
  <SC_PaneInput>
    <AInput
      v-model:value="page.indexFilter.value"
      allow-clear
      :placeholder="t('help.index.placeholder')"
      @press-enter="openFirst"
    />
  </SC_PaneInput>
  <SC_List v-if="entries.length">
    <li v-for="entry in entries" :key="entry.keyword">
      <SC_ItemButton
        type="button"
        :aria-expanded="multi(entry) ? expanded === entry.keyword : undefined"
        @click="choose(entry)"
      >
        <span>{{ entry.keyword }}</span>
        <SC_Count v-if="multi(entry)">{{
          t('help.index.topics', { n: entry.topics.length })
        }}</SC_Count>
      </SC_ItemButton>
      <!-- Слово встречается в нескольких статьях — выбрать, как «Найденные разделы» в CHM. -->
      <SC_SubList v-if="multi(entry) && expanded === entry.keyword">
        <li v-for="id in entry.topics" :key="id">
          <SC_Result :href="topicPath(id)" @click="open($event, id)">
            <SC_ResultTitle>{{ titleOf(id) }}</SC_ResultTitle>
            <SC_ResultWhere v-if="page.whereIs(id)">{{ page.whereIs(id) }}</SC_ResultWhere>
          </SC_Result>
        </li>
      </SC_SubList>
    </li>
  </SC_List>
  <SC_Empty v-else>{{ t('help.index.empty') }}</SC_Empty>
</template>

<script setup lang="ts">
// «Указатель»: ключевые слова статей и их заголовки по алфавиту. Фильтр по
// мере набора: сначала слова, которые начинаются с набранного.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input as AInput } from 'ant-design-vue'
import { topicPath } from '@/b-components/help/help-view'
import type { HelpIndexEntry } from '@/helpers/help/help-types'
import { useHelpPageContext } from '../use-help-page'
import {
  SC_Count,
  SC_Empty,
  SC_ItemButton,
  SC_List,
  SC_PaneInput,
  SC_Result,
  SC_ResultTitle,
  SC_ResultWhere,
  SC_SubList,
} from '../help-page.styled'

const { t } = useI18n()
const page = useHelpPageContext()
const expanded = ref<string | null>(null)

const normalize = (s: string): string => s.trim().toLowerCase().replace(/ё/g, 'е')

const entries = computed<HelpIndexEntry[]>(() => {
  const index = page.library.value?.index ?? []
  const q = normalize(page.indexFilter.value)
  if (!q) return index
  const starts: HelpIndexEntry[] = []
  const contains: HelpIndexEntry[] = []
  for (const entry of index) {
    const keyword = normalize(entry.keyword)
    if (keyword.startsWith(q)) starts.push(entry)
    else if (keyword.includes(q)) contains.push(entry)
  }
  return [...starts, ...contains]
})

const multi = (entry: HelpIndexEntry): boolean => entry.topics.length > 1

function titleOf(id: string): string {
  return page.library.value?.topics.get(id)?.title ?? id
}

function choose(entry: HelpIndexEntry): void {
  const [only] = entry.topics
  if (!multi(entry) && only) page.openTopic(only)
  else expanded.value = expanded.value === entry.keyword ? null : entry.keyword
}

function open(event: MouseEvent, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  page.openTopic(id)
}

function openFirst(): void {
  const first = entries.value[0]
  if (first) choose(first)
}
</script>
