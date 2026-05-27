<template>
  <SC_HeaderSearchWrapper
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown.esc="close"
    @keyup="onKeyUp"
  >
    <InputSearch
      v-model:value="searchQuery"
      :placeholder="searchData.placeholder"
      :maxlength="searchData.maxLength"
      allow-clear
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      @search="onEnter"
    />

    <HeaderSearchDropdown v-if="isOpen" :query="debouncedQuery" @close="close" />
  </SC_HeaderSearchWrapper>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search-store'
import { MIN_QUERY_LENGTH } from '@/composables/use-search-query'
import { sanitizeSearchQuery } from '@/services/search-service'
import {
  ensureUserResolverLoaded,
  resolveNameLocal,
  resolveNameRemote,
} from '@/services/user-resolver'
import { parseBastyonInput } from '@/services/bastyon-input-link'
import InputSearch from '@/components/input-search/input-search.vue'
import HeaderSearchDropdown from './header-search-dropdown.vue'
import { searchData } from '@/b-components/header/dummy-data/search-data'
import { SC_HeaderSearchWrapper } from './styled'

const DEBOUNCE_MS = 450

// «Hot-стопы»: символы, которые сигнализируют о завершении слова.
// В оригинале их ввод не сдвигает debounce-таймер (mobilesearch/index.js:139),
// фактически — позволяет уже стоящему таймеру выстрелить. Здесь
// реализуем эквивалентный эффект: при вводе hot-stop сразу обновляем
// `debouncedQuery`, не дожидаясь окончания DEBOUNCE_MS.
const HOT_STOP_RE = /^[,.!?;:() ]$/

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

// Dropdown открыт когда инпут в фокусе И (есть достаточно длинный запрос,
// чтобы запустить поисковые RPC, ИЛИ есть история — тогда показываем Recent).
const isOpen = computed(() => {
  if (!isFocused.value) return false
  if (debouncedQuery.value.length >= MIN_QUERY_LENGTH) return true
  return searchStore.recentHistory.length > 0
})

onMounted(() => {
  void searchStore.ensureLoaded()
  void ensureUserResolverLoaded()
})

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

function onKeyUp(e: KeyboardEvent): void {
  if (!HOT_STOP_RE.test(e.key)) return
  if (searchStore.query.length === 0) return
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  debouncedQuery.value = sanitizeSearchQuery(searchStore.query)
}

async function onEnter(value: string): Promise<void> {
  const raw = value.trim()
  if (!raw) return

  // Bastyon-URL — прямая навигация по таргету, как в оригинальном
  // `thislink()` (menu/index.js:827-836). Парсим до резолва ника:
  // строка вида `bastyon.com/@name` должна идти на профиль, не в поиск.
  const parsedUrl = parseBastyonInput(raw)
  if (parsedUrl) {
    close()
    searchStore.setQuery('')
    if (parsedUrl.kind === 'profile') {
      router.push({ name: 'profile', params: { userName: parsedUrl.userName } })
      return
    }
    if (parsedUrl.kind === 'search') {
      searchStore.commit(parsedUrl.query)
      const query: Record<string, string> = { q: parsedUrl.query }
      if (parsedUrl.tagMode) query.type = 'posts'
      router.push({ path: '/search', query })
      return
    }
  }

  // Префикс @ — явный сигнал «это имя пользователя»: пытаемся резолвить
  // (локально, потом удалённо через searchusers) и навигировать прямо
  // на профиль, минуя поисковую выдачу.
  if (raw.startsWith('@')) {
    const name = raw.slice(1).trim()
    if (name) {
      close()
      searchStore.setQuery('')
      const local = resolveNameLocal(name)
      const address = local ?? (await resolveNameRemote(name))
      if (address) {
        searchStore.commitUser(address, name)
        router.push({ name: 'profile', params: { userName: address } })
        return
      }
      // Не резолвился — fall back на обычный поиск без префикса.
      const fallback = searchStore.commit(name)
      if (fallback) router.push({ path: '/search', query: { q: fallback } })
      return
    }
  }

  const committed = searchStore.commit(raw)
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
