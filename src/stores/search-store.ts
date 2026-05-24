import { defineStore } from 'pinia'
import { sanitizeSearchQuery } from '@/services/search-service'

/**
 * Store для состояния строки поиска и истории запросов.
 *
 * Данные результатов поиска НЕ хранятся здесь — за них отвечают composables
 * на основе TanStack Query (см. composables/use-search-query.ts). Store держит
 * только то, чем управляет пользователь напрямую: текущий ввод и историю.
 */
export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    history: [] as string[],
    maxHistoryLength: 10,
  }),

  getters: {
    hasQuery(): boolean {
      return sanitizeSearchQuery(this.query).length > 0
    },

    recentHistory(): string[] {
      return this.history.slice(0, this.maxHistoryLength)
    },
  },

  actions: {
    setQuery(query: string): void {
      this.query = query
    },

    /**
     * Фиксирует «коммит» поиска — добавляет нормализованный запрос в историю.
     * Вызывается, когда пользователь нажимает Enter или выбирает подсказку.
     * Сама загрузка данных делается composables, а не этим методом.
     */
    commit(query?: string): string {
      const value = sanitizeSearchQuery(query ?? this.query)
      if (!value) return ''

      this.query = value

      const idx = this.history.indexOf(value)
      if (idx !== -1) this.history.splice(idx, 1)
      this.history.unshift(value)
      if (this.history.length > this.maxHistoryLength) {
        this.history = this.history.slice(0, this.maxHistoryLength)
      }

      return value
    },

    clearQuery(): void {
      this.query = ''
    },

    clearHistory(): void {
      this.history = []
    },

    removeFromHistory(query: string): void {
      this.history = this.history.filter((item) => item !== query)
    },
  },
})
