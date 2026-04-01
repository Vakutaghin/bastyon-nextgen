import { defineStore } from 'pinia'

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    results: [] as any[],
    loading: false,
    error: null as string | null,
    history: [] as string[],
    maxHistoryLength: 10
  }),

  getters: {
    /**
     * Проверяет, есть ли активный поисковый запрос
     */
    hasQuery(): boolean {
      return this.query.trim().length > 0
    },

    /**
     * Проверяет, есть ли результаты поиска
     */
    hasResults(): boolean {
      return this.results.length > 0
    },

    /**
     * Получает историю поиска (последние N запросов)
     */
    recentHistory(): string[] {
      return this.history.slice(0, this.maxHistoryLength)
    }
  },

  actions: {
    /**
     * Устанавливает поисковый запрос
     */
    setQuery(query: string): void {
      this.query = query
    },

    /**
     * Выполняет поиск
     */
    async search(query?: string): Promise<void> {
      const searchQuery = query || this.query

      if (!searchQuery.trim()) {
        this.results = []
        return
      }

      this.loading = true
      this.error = null
      this.query = searchQuery

      try {
        // TODO: Реализовать поиск через API

        // Добавляем в историю, если еще нет
        if (!this.history.includes(searchQuery)) {
          this.history.unshift(searchQuery)
          // Ограничиваем размер истории
          if (this.history.length > this.maxHistoryLength) {
            this.history = this.history.slice(0, this.maxHistoryLength)
          }
        }

        // TODO: Реализовать реальный поиск через API
        this.results = []
      } catch (err: any) {
        this.error = err.message || 'Ошибка поиска'
        this.results = []
      } finally {
        this.loading = false
      }
    },

    /**
     * Очищает поисковый запрос
     */
    clearQuery(): void {
      this.query = ''
      this.results = []
    },

    /**
     * Очищает историю поиска
     */
    clearHistory(): void {
      this.history = []
    },

    /**
     * Удаляет элемент из истории
     */
    removeFromHistory(query: string): void {
      this.history = this.history.filter(item => item !== query)
    }
  }
})
