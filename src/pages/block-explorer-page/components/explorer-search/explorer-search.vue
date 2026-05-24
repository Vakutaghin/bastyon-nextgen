<template>
  <div>
    <SC_SearchWrapper ref='wrapperRef'>
      <SC_ExplorerSearch @submit.prevent='submit'>
        <SC_ExplorerSearchInput
          v-model='query'
          type='text'
          :placeholder="placeholder"
          autocomplete='off'
          autocapitalize='off'
          autocorrect='off'
          spellcheck='false'
          @focus='focused = true'
          @keydown.escape='focused = false'
        />
        <SC_ExplorerSearchHint v-if='hintLabel'>{{ hintLabel }}</SC_ExplorerSearchHint>
        <SC_ExplorerSearchButton
          type='submit'
          :disabled='!canSubmit || resolving'
        >
          {{ resolving ? s.search.submitting : s.search.submit }}
        </SC_ExplorerSearchButton>
      </SC_ExplorerSearch>

      <SC_SuggestionsDropdown v-if='dropdownVisible'>
        <SC_SuggestionsHeader>
          <span>{{ s.search.suggestionsTitle }}</span>
          <SC_ClearAllBtn type='button' @click='onClearAll'>
            {{ s.search.clearAll }}
          </SC_ClearAllBtn>
        </SC_SuggestionsHeader>
        <SC_SuggestionItem
          v-for='entry in suggestions'
          :key='`${entry.kind}-${entry.value}`'
          type='button'
          @click='pickSuggestion(entry)'
        >
          <SC_KindBadge :kind='entry.kind'>{{ kindLabel(entry.kind) }}</SC_KindBadge>
          <SC_SuggestionValue :title='entry.value'>{{ shortenValue(entry.value) }}</SC_SuggestionValue>
          <SC_SuggestionAge>{{ ageLabel(entry.lastVisitedAt) }}</SC_SuggestionAge>
          <SC_RemoveItemBtn
            role='button'
            :title='s.search.removeFromHistory'
            @click.stop='onRemoveEntry(entry)'
          >
            ×
          </SC_RemoveItemBtn>
        </SC_SuggestionItem>
      </SC_SuggestionsDropdown>
    </SC_SearchWrapper>

    <SC_ExplorerSearchError v-if='errorMessage'>
      {{ errorMessage }}
    </SC_ExplorerSearchError>
  </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import type { SearchByHashResponse } from '@/types/rpc-responses/search-by-hash'
import { classifyExplorerQuery } from './use-explorer-search'
import {
  useSearchHistory,
  recordVisit,
  removeEntry as removeEntryFn,
  clearHistory,
  type HistoryEntry,
  type HistoryKind,
} from '../../components/shared/use-search-history'
import { shortenHash, formatRelativeTime } from '../../components/shared/format-explorer'
import { explorerStrings as s } from '../../block-explorer-strings'
import {
  SC_ExplorerSearch,
  SC_ExplorerSearchInput,
  SC_ExplorerSearchHint,
  SC_ExplorerSearchButton,
  SC_ExplorerSearchError,
  SC_SearchWrapper,
  SC_SuggestionsDropdown,
  SC_SuggestionsHeader,
  SC_ClearAllBtn,
  SC_SuggestionItem,
  SC_KindBadge,
  SC_SuggestionValue,
  SC_SuggestionAge,
  SC_RemoveItemBtn,
} from './explorer-search.styled'

withDefaults(
  defineProps<{
    placeholder?: string
  }>(),
  {
    placeholder: s.search.placeholder,
  },
)

const router = useRouter()
const query = ref('')
const resolving = ref(false)
const errorMessage = ref('')
const focused = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const { filterByPrefix } = useSearchHistory()

const classification = computed(() => classifyExplorerQuery(query.value))
const canSubmit = computed(() => classification.value.value.length > 0)

const hintLabel = computed(() => {
  switch (classification.value.kind) {
    case 'block-height': return s.search.hintBlock
    case 'address':      return s.search.hintAddress
    case 'hash64':       return s.search.hintHash
    default:             return ''
  }
})

const suggestions = computed(() => filterByPrefix(query.value).slice(0, 8))
const dropdownVisible = computed(() => focused.value && suggestions.value.length > 0)

function kindLabel(kind: HistoryKind): string {
  switch (kind) {
    case 'block':   return s.search.suggestionsKindBlock
    case 'tx':      return s.search.suggestionsKindTx
    case 'address': return s.search.suggestionsKindAddress
  }
}

function shortenValue(v: string): string {
  // Адреса 34 симв. показываем целиком, hex64 — middle-ellipsis, числа — целиком.
  if (v.length > 24) return shortenHash(v, 10, 8)
  return v
}

function ageLabel(unixSeconds: number): string {
  return formatRelativeTime(unixSeconds)
}

function pickSuggestion(entry: HistoryEntry) {
  focused.value = false
  const name =
    entry.kind === 'block' ? 'explorer-block'
      : entry.kind === 'tx' ? 'explorer-tx'
        : 'explorer-address'
  const paramKey =
    entry.kind === 'block' ? 'hashOrHeight'
      : entry.kind === 'tx' ? 'txid'
        : 'address'
  recordVisit(entry.value, entry.kind)
  router.push({ name, params: { [paramKey]: entry.value } })
  query.value = ''
}

function onRemoveEntry(entry: HistoryEntry) {
  removeEntryFn(entry.value, entry.kind)
}

function onClearAll() {
  clearHistory()
  focused.value = false
}

async function submit() {
  errorMessage.value = ''
  focused.value = false
  const { kind, value } = classification.value
  if (!value) return

  switch (kind) {
    case 'block-height':
      go('explorer-block', value)
      return
    case 'address':
      go('explorer-address', value)
      return
    case 'hash64':
      await resolveHash64(value)
      return
    default:
      await fallbackServerSearch(value)
  }
}

async function resolveHash64(value: string) {
  resolving.value = true
  try {
    const resp = (await getByPRC({
      method: rpcEndpoints.searchByHash,
      parameters: [value],
      options: { auth: false },
    }, getExplorerRpcConfig())) as SearchByHashResponse
    const type = resp?.data?.type
    if (type === 'block') return go('explorer-block', value)
    if (type === 'transaction') return go('explorer-tx', value)
    if (type === 'address') return go('explorer-address', value)
    go('explorer-block', value)
  } catch {
    go('explorer-block', value)
  } finally {
    resolving.value = false
  }
}

async function fallbackServerSearch(value: string) {
  resolving.value = true
  try {
    const resp = (await getByPRC({
      method: rpcEndpoints.searchByHash,
      parameters: [value],
      options: { auth: false },
    }, getExplorerRpcConfig())) as SearchByHashResponse
    const type = resp?.data?.type
    if (type === 'block')        return go('explorer-block', value)
    if (type === 'transaction')  return go('explorer-tx', value)
    if (type === 'address')      return go('explorer-address', value)
    errorMessage.value = s.search.errorUnknown
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : s.search.errorNetwork
  } finally {
    resolving.value = false
  }
}

function go(name: 'explorer-block' | 'explorer-tx' | 'explorer-address', id: string) {
  const paramKey =
    name === 'explorer-block' ? 'hashOrHeight'
      : name === 'explorer-tx' ? 'txid'
        : 'address'
  // Записываем в историю как соответствующий kind.
  const kind: HistoryKind =
    name === 'explorer-block' ? 'block'
      : name === 'explorer-tx' ? 'tx'
        : 'address'
  recordVisit(id, kind)
  router.push({ name, params: { [paramKey]: id } })
  query.value = ''
}

// Закрытие дропдауна по клику вне.
function onDocumentClick(e: Event) {
  if (!wrapperRef.value) return
  const target = e.target as Node
  if (!wrapperRef.value.contains(target)) {
    focused.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
})
</script>
