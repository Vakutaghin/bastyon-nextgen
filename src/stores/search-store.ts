import { defineStore } from 'pinia'
import { sanitizeSearchQuery } from '@/services/search-service'
import { settingsAPI } from '@/db/apis/settings-api'
import {
  MAX_HISTORY_LENGTH,
  SEARCH_HISTORY_STORAGE_KEY,
  isSameHistoryEntry,
  type SearchHistoryEntry,
  type SearchHistoryKind,
} from './search-store-consts'

/**
 * Store для состояния строки поиска и истории запросов.
 *
 * Данные результатов поиска НЕ хранятся здесь — за них отвечают composables
 * на основе TanStack Query (см. composables/use-search-query.ts). Store держит
 * только то, чем управляет пользователь напрямую: текущий ввод и историю.
 *
 * История персистится в IndexedDB через settingsAPI: ключ
 * SEARCH_HISTORY_STORAGE_KEY, значение — массив SearchHistoryEntry. Запись
 * происходит асинхронно после каждого мутирующего действия; чтение — один
 * раз через `ensureLoaded()` при первом использовании.
 */

function isValidEntry(value: unknown): value is SearchHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    (e.kind === 'query' || e.kind === 'user' || e.kind === 'tag' || e.kind === 'app') &&
    typeof e.value === 'string' &&
    typeof e.addedAt === 'number'
  )
}

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    history: [] as SearchHistoryEntry[],
    maxHistoryLength: MAX_HISTORY_LENGTH,
    isHistoryLoaded: false,
  }),

  getters: {
    hasQuery(): boolean {
      return sanitizeSearchQuery(this.query).length > 0
    },

    recentHistory(): SearchHistoryEntry[] {
      return this.history.slice(0, this.maxHistoryLength)
    },

    /** Только запросы — для случаев, где нужны строки (например, suggest). */
    recentQueries(): string[] {
      return this.history
        .filter((e) => e.kind === 'query')
        .map((e) => e.value)
        .slice(0, this.maxHistoryLength)
    },
  },

  actions: {
    setQuery(query: string): void {
      this.query = query
    },

    clearQuery(): void {
      this.query = ''
    },

    /**
     * Загружает историю из IndexedDB. Безопасно вызывать многократно:
     * флаг `isHistoryLoaded` ставится сразу, чтобы параллельный вызов
     * сразу вышел; если за время чтения история уже была изменена
     * (например, пользователь успел что-то ввести), мы её не перетираем.
     */
    async ensureLoaded(): Promise<void> {
      if (this.isHistoryLoaded) return
      this.isHistoryLoaded = true
      try {
        const raw = await settingsAPI.get(SEARCH_HISTORY_STORAGE_KEY)
        if (Array.isArray(raw) && this.history.length === 0) {
          this.history = raw.filter(isValidEntry).slice(0, this.maxHistoryLength)
        }
      } catch (e) {
        console.error('Failed to load search history:', e)
      }
    },

    /**
     * Фиксирует «коммит» текстового поиска — добавляет нормализованный запрос
     * в историю. Вызывается, когда пользователь нажимает Enter или выбирает
     * подсказку без явной семантики (user / tag / app).
     */
    commit(query?: string): string {
      const value = sanitizeSearchQuery(query ?? this.query)
      if (!value) return ''

      this.query = value
      this.pushEntry({
        kind: 'query',
        value,
        label: value,
        addedAt: Date.now(),
      })

      return value
    },

    /** Запомнить, что пользователь открыл профиль из поисковой выдачи. */
    commitUser(address: string, name?: string, avatar?: string): void {
      if (!address) return
      this.pushEntry({
        kind: 'user',
        value: address,
        label: name || address,
        addedAt: Date.now(),
        meta: avatar || name ? { avatar, name } : undefined,
      })
    },

    /** Запомнить, что пользователь перешёл на поиск по тегу. */
    commitTag(tag: string): void {
      const clean = tag.replace(/^#+/, '').trim()
      if (!clean) return
      this.pushEntry({
        kind: 'tag',
        value: clean,
        label: `#${clean}`,
        addedAt: Date.now(),
      })
    },

    /** Запомнить открытие mini-app из dropdown поиска. */
    commitApp(appId: string, name?: string, icon?: string): void {
      if (!appId) return
      this.pushEntry({
        kind: 'app',
        value: appId,
        label: name || appId,
        addedAt: Date.now(),
        meta: icon || name ? { icon, name } : undefined,
      })
    },

    clearHistory(): void {
      this.history = []
      void this.persistHistory()
    },

    removeFromHistory(entry: SearchHistoryEntry | string): void {
      if (typeof entry === 'string') {
        this.history = this.history.filter(
          (item) => !(item.kind === 'query' && item.value === entry)
        )
      } else {
        this.history = this.history.filter((item) => !isSameHistoryEntry(item, entry))
      }
      void this.persistHistory()
    },

    /**
     * Внутренний хелпер: положить запись в начало, убрав дубликат,
     * урезать до лимита и записать в IDB.
     */
    pushEntry(entry: SearchHistoryEntry): void {
      this.history = [entry, ...this.history.filter((e) => !isSameHistoryEntry(e, entry))]
      if (this.history.length > this.maxHistoryLength) {
        this.history = this.history.slice(0, this.maxHistoryLength)
      }
      void this.persistHistory()
    },

    async persistHistory(): Promise<void> {
      try {
        // IndexedDB structured clone не справляется с Vue reactive Proxy
        // (внутренние Symbol-поля), поэтому сериализуем в plain JSON.
        const plain = JSON.parse(JSON.stringify(this.history)) as SearchHistoryEntry[]
        await settingsAPI.set(SEARCH_HISTORY_STORAGE_KEY, plain)
      } catch (e) {
        console.error('Failed to persist search history:', e)
      }
    },
  },
})

export type { SearchHistoryEntry, SearchHistoryKind }
