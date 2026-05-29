/**
 * Работа с историей поиска в header-search dropdown:
 * - Чтение `recentEntries` из `useSearchStore`.
 * - Выбор записи (переход + commit).
 * - Удаление / очистка.
 * - Визуальные хелперы для иконки и вторичного текста.
 *
 * См. CODE_AUDIT.md §1.
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { useSearchStore } from '@/stores/search-store'
import type { SearchHistoryEntry, SearchHistoryKind } from '@/stores/search-store-consts'

export interface SearchRecent {
  recentEntries: ComputedRef<SearchHistoryEntry[]>
  showRecent: ComputedRef<boolean>
  iconForKind: (kind: SearchHistoryKind) => string
  secondaryFor: (entry: SearchHistoryEntry) => string | undefined
  onSelectRecent: (entry: SearchHistoryEntry) => void
  onRemoveRecent: (entry: SearchHistoryEntry) => void
  onClearHistory: () => void
}

export function useSearchRecent(
  router: Router,
  showResults: Ref<boolean>,
  emitClose: () => void
): SearchRecent {
  const searchStore = useSearchStore()
  const recentEntries = computed<SearchHistoryEntry[]>(() => searchStore.recentHistory)
  const showRecent = computed(() => !showResults.value && recentEntries.value.length > 0)

  function iconForKind(kind: SearchHistoryKind): string {
    switch (kind) {
      case 'query':
        return '⌕'
      case 'tag':
        return '#'
      case 'user':
        return '@'
      case 'app':
        return '▦'
    }
  }

  function secondaryFor(entry: SearchHistoryEntry): string | undefined {
    if (entry.kind === 'user' && entry.meta?.name && entry.meta.name !== entry.label) {
      return entry.value
    }
    return undefined
  }

  function onSelectRecent(entry: SearchHistoryEntry): void {
    emitClose()
    switch (entry.kind) {
      case 'query':
        searchStore.setQuery(entry.value)
        searchStore.commit(entry.value)
        router.push({ path: '/search', query: { q: entry.value } })
        return
      case 'tag':
        searchStore.commitTag(entry.value)
        router.push({ path: '/search', query: { q: `#${entry.value}`, type: 'posts' } })
        return
      case 'user':
        searchStore.commitUser(entry.value, entry.meta?.name, entry.meta?.avatar)
        router.push({ name: 'profile', params: { userName: entry.value } })
        return
      case 'app':
        // Запись в истории создаётся только когда приложение уже было
        // открыто из dropdown — значит оно зарегистрировано в appsStore через
        // installFromRemoteEntry и доступно по /app/<id>.
        router.push(`/app/${encodeURIComponent(entry.value)}`)
        return
    }
  }

  function onRemoveRecent(entry: SearchHistoryEntry): void {
    searchStore.removeFromHistory(entry)
  }

  function onClearHistory(): void {
    searchStore.clearHistory()
  }

  return {
    recentEntries,
    showRecent,
    iconForKind,
    secondaryFor,
    onSelectRecent,
    onRemoveRecent,
    onClearHistory,
  }
}
