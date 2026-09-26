<template>
  <SC_PaneInput>
    <AInput
      v-model:value="page.searchQuery.value"
      allow-clear
      :placeholder="t('help.search.placeholder')"
      @press-enter="openFirst"
    />
  </SC_PaneInput>
  <SC_PaneHint v-if="!query">{{ t('help.search.hint') }}</SC_PaneHint>
  <SC_List v-else-if="hits.length">
    <li v-for="hit in hits" :key="hit.id">
      <SC_Result :href="topicPath(hit.id)" @click="open($event, hit.id)">
        <SC_ResultTitle>{{ hit.title }}</SC_ResultTitle>
        <SC_ResultWhere v-if="page.whereIs(hit.id)">{{ page.whereIs(hit.id) }}</SC_ResultWhere>
        <SC_ResultSnippet>
          <template v-for="(part, i) in hit.snippet" :key="i">
            <mark v-if="part.mark">{{ part.text }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </SC_ResultSnippet>
      </SC_Result>
    </li>
  </SC_List>
  <SC_Empty v-else>{{ t('help.search.empty') }}</SC_Empty>
</template>

<script setup lang="ts">
// «Поиск» по тексту всех статей с учётом окончаний. Открытая из выдачи статья
// подсвечивает найденные слова (`?hl=`), как в CHM.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input as AInput } from 'ant-design-vue'
import { topicPath } from '@/b-components/help/help-view'
import { helpSearch } from '@/helpers/help/help-search'
import { useHelpPageContext } from '../use-help-page'
import {
  SC_Empty,
  SC_List,
  SC_PaneHint,
  SC_PaneInput,
  SC_Result,
  SC_ResultSnippet,
  SC_ResultTitle,
  SC_ResultWhere,
} from '../help-page.styled'

const DEBOUNCE_MS = 150

const { t } = useI18n()
const page = useHelpPageContext()

/** Запрос, по которому ищем: догоняет набранное с паузой. */
const query = ref(page.searchQuery.value.trim())
let timer: ReturnType<typeof setTimeout> | null = null
watch(page.searchQuery, (value) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (query.value = value.trim()), DEBOUNCE_MS)
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const hits = computed(() => {
  const library = page.library.value
  return library && query.value ? helpSearch(library).search(query.value) : []
})

function open(event: MouseEvent, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  page.openTopic(id, query.value)
}

function openFirst(): void {
  query.value = page.searchQuery.value.trim()
  const first = hits.value[0]
  if (first) page.openTopic(first.id, query.value)
}
</script>
