import { defineStore } from 'pinia'
import { SCROLL_POSITION_PREFIX } from '@/blockchain/constants/storage'

export const useUIStore = defineStore('ui', {
  state: () => ({
    scrollPositions: new Map<string, number>(),
    loadingStates: new Map<string, boolean>(),
    theme: 'light' as 'light' | 'dark',
    sidebarCollapsed: false
  }),

  getters: {
    /**
     * Получает позицию скролла по ключу
     */
    getScrollPosition(): (key: string) => number {
      return (key: string) => {
        return this.scrollPositions.get(key) || 0
      }
    },

    /**
     * Проверяет, загружается ли что-то по ключу
     */
    isLoading(): (key: string) => boolean {
      return (key: string) => {
        return this.loadingStates.get(key) || false
      }
    }
  },

  actions: {
    /**
     * Сохраняет позицию скролла
     */
    saveScrollPosition(key: string, position?: number): void {
      const scrollTop = position !== undefined
        ? position
        : window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      this.scrollPositions.set(key, scrollTop)

      // Сохраняем в sessionStorage как резерв
      try {
        sessionStorage.setItem(`${SCROLL_POSITION_PREFIX}${key}`, String(scrollTop))
      } catch (e) {
        // Игнорируем ошибки sessionStorage
      }
    },

    /**
     * Восстанавливает позицию скролла
     */
    restoreScrollPosition(key: string): void {
      const position = this.scrollPositions.get(key)
      if (position !== undefined) {
        window.scrollTo({
          top: position,
          left: 0,
          behavior: 'instant'
        })
      } else {
        // Пытаемся восстановить из sessionStorage
        try {
          const saved = sessionStorage.getItem(`${SCROLL_POSITION_PREFIX}${key}`)
          if (saved) {
            const position = parseInt(saved, 10)
            window.scrollTo({
              top: position,
              left: 0,
              behavior: 'instant'
            })
          }
        } catch (e) {
          // Игнорируем ошибки sessionStorage
        }
      }
    },

    /**
     * Устанавливает состояние загрузки
     */
    setLoading(key: string, loading: boolean): void {
      this.loadingStates.set(key, loading)
    },

    /**
     * Переключает тему
     */
    toggleTheme(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },

    /**
     * Устанавливает тему
     */
    setTheme(theme: 'light' | 'dark'): void {
      this.theme = theme
    },

    /**
     * Переключает состояние сайдбара
     */
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },

    /**
     * Устанавливает состояние сайдбара
     */
    setSidebarCollapsed(collapsed: boolean): void {
      this.sidebarCollapsed = collapsed
    },

    /**
     * Очищает позиции скролла
     */
    clearScrollPositions(): void {
      this.scrollPositions.clear()
    },

    /**
     * Очищает состояния загрузки
     */
    clearLoadingStates(): void {
      this.loadingStates.clear()
    }
  }
})
