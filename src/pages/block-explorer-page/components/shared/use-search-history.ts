/**
 * История просмотров в блок-эксплорере.
 *
 * Хранит до MAX_ENTRIES последних посещённых блоков / транзакций / адресов
 * в localStorage. Используется выпадающим списком в `explorer-search` как
 * автокомплит при focus / вводе.
 *
 * Намеренно живёт ТОЛЬКО на устройстве пользователя:
 *   - история — приватная;
 *   - синхронизация между устройствами не нужна и противоречит [[principle_decentralization]];
 *   - запись производится явно (через recordVisit), а не из URL — чтобы случайный
 *     hit (например, deeplink из соцсети) не плодил мусор.
 */

import { ref, computed, type Ref } from 'vue'

const STORAGE_KEY = 'bastyon.explorer.searchHistory.v1'
const MAX_ENTRIES = 20

export type HistoryKind = 'block' | 'tx' | 'address'

export interface HistoryEntry {
  /** Ключ — то, что пользователь ищет. Для block это height ИЛИ hash, как было введено. */
  value: string
  kind: HistoryKind
  /** Unix-секунды последнего посещения. Используется для сортировки + UI. */
  lastVisitedAt: number
  /** Сколько раз пользователь возвращался к этой странице (для будущего рейтинга). */
  hits: number
}

// In-memory разделяемый стейт — все экземпляры composable-а смотрят на один и тот же
// массив, и записи из любой страницы сразу отражаются в выпадайке поиска.
const entries: Ref<HistoryEntry[]> = ref([])
let loaded = false

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

function persist(): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
  } catch {
    // QuotaExceeded / приватный режим — молча игнорируем, история не критична.
  }
}

function loadFromStorage(): void {
  if (loaded || !isStorageAvailable()) {
    loaded = true
    return
  }
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    entries.value = (parsed as Partial<HistoryEntry>[])
      .filter((e): e is HistoryEntry =>
        typeof e === 'object' && e !== null &&
        typeof e.value === 'string' && e.value.length > 0 &&
        (e.kind === 'block' || e.kind === 'tx' || e.kind === 'address') &&
        typeof e.lastVisitedAt === 'number' &&
        typeof e.hits === 'number',
      )
      .slice(0, MAX_ENTRIES)
  } catch {
    // Битый JSON — стартуем с пустой истории.
  }
}

export function recordVisit(value: string, kind: HistoryKind): void {
  loadFromStorage()
  const v = value.trim()
  if (!v) return
  const now = Math.floor(Date.now() / 1000)
  const idx = entries.value.findIndex((e) => e.kind === kind && e.value === v)
  if (idx >= 0) {
    const found = entries.value[idx]!
    entries.value.splice(idx, 1)
    entries.value.unshift({
      ...found,
      lastVisitedAt: now,
      hits: found.hits + 1,
    })
  } else {
    entries.value.unshift({ value: v, kind, lastVisitedAt: now, hits: 1 })
    if (entries.value.length > MAX_ENTRIES) {
      entries.value.length = MAX_ENTRIES
    }
  }
  persist()
}

export function removeEntry(value: string, kind: HistoryKind): void {
  loadFromStorage()
  const idx = entries.value.findIndex((e) => e.kind === kind && e.value === value)
  if (idx >= 0) {
    entries.value.splice(idx, 1)
    persist()
  }
}

export function clearHistory(): void {
  entries.value = []
  persist()
}

/**
 * Composable: возвращает реактивную историю + утилиту фильтрации.
 * Загрузка из localStorage идёт лениво при первом вызове.
 */
export function useSearchHistory() {
  loadFromStorage()

  const sortedHistory = computed(() =>
    [...entries.value].sort((a, b) => b.lastVisitedAt - a.lastVisitedAt),
  )

  function filterByPrefix(prefix: string): HistoryEntry[] {
    const p = prefix.trim().toLowerCase()
    const list = sortedHistory.value
    if (!p) return list
    return list.filter(
      (e) =>
        e.value.toLowerCase().startsWith(p) ||
        e.value.toLowerCase().includes(p),
    )
  }

  return {
    history: sortedHistory,
    filterByPrefix,
    recordVisit,
    removeEntry,
    clearHistory,
  }
}
