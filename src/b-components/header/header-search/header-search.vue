<template>
  <SC_HeaderSearchWrapper @focusin='onFocusIn' @focusout='onFocusOut' @keydown.esc='close'>
    <InputSearch
      v-model:value='searchQuery'
      :placeholder='searchData.placeholder'
      :maxlength='searchData.maxLength'
      allow-clear
      autocomplete='off'
      autocorrect='off'
      autocapitalize='off'
      spellcheck='false'
      @search='onEnter'
    />

    <HeaderSearchDropdown
      v-if='isOpen'
      :query='debouncedQuery'
      @close='close'
    />
  </SC_HeaderSearchWrapper>
</template>

<script setup lang='ts'>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search-store'
import { MIN_QUERY_LENGTH } from '@/composables/use-search-query'
import { sanitizeSearchQuery } from '@/services/search-service'
import InputSearch from '@/components/input-search/input-search.vue'
import HeaderSearchDropdown from './header-search-dropdown.vue'
import { searchData } from '@/b-components/header/dummy-data/search-data'
import { SC_HeaderSearchWrapper } from './styled'

const DEBOUNCE_MS = 450

const router = useRouter()
const searchStore = useSearchStore()

const searchQuery = computed<string>({
  get: () => searchStore.query,
  set: (value) => searchStore.setQuery(value),
})

const isFocused = ref(false)
const debouncedQuery = ref(sanitizeSearchQuery(searchStore.query))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let blurTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => searchStore.query,
  (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = sanitizeSearchQuery(value)
    }, DEBOUNCE_MS)
  }
)

const isOpen = computed(() => isFocused.value && debouncedQuery.value.length >= MIN_QUERY_LENGTH)

function onFocusIn(): void {
  if (blurTimer) {
    clearTimeout(blurTimer)
    blurTimer = null
  }
  isFocused.value = true
}

function onFocusOut(event: Event): void {
  const next = (event as unknown as { relatedTarget: Node | null }).relatedTarget
  const wrapper = event.currentTarget as HTMLElement
  if (next && wrapper.contains(next)) return
  // Slight delay so click on items inside dropdown can complete first.
  blurTimer = setTimeout(() => {
    isFocused.value = false
    blurTimer = null
  }, 150)
}

function close(): void {
  isFocused.value = false
}

function onEnter(value: string): void {
  const committed = searchStore.commit(value)
  if (!committed) return
  close()
  router.push({ path: '/search', query: { q: committed } })
}

watch(
  () => router.currentRoute.value.fullPath,
  () => close()
)

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (blurTimer) clearTimeout(blurTimer)
})
</script>
