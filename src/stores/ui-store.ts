import { defineStore } from 'pinia'
import { SCROLL_POSITION_PREFIX } from '@/blockchain/constants/storage'
import { settingsAPI } from '@/db/apis/settings-api'
import { detectInitialLocale, readStoredLocale, setI18nLocale, type Locale } from '@/i18n'

export type AppLanguage = Locale

const SETTING_KEY_LANGUAGE = 'bastyonAppLanguage'

// Тема живёт в composables/use-theme (data-theme на <html>, localStorage) —
// здесь её нет: поле `theme` в сторе никто не писал, и мини-аппы никогда не
// получали theme.changed (V42).
export const useUIStore = defineStore('ui', {
  state: () => ({
    scrollPositions: new Map<string, number>(),
    loadingStates: new Map<string, boolean>(),
    sidebarCollapsed: false,
    // Тот же детектор, что у vue-i18n на буте: стор и i18n стартуют с одного значения.
    language: detectInitialLocale() as AppLanguage,
    languageLoaded: false,
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
    },
  },

  actions: {
    /**
     * Сохраняет позицию скролла
     */
    saveScrollPosition(key: string, position?: number): void {
      const scrollTop =
        position !== undefined
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
          behavior: 'instant',
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
              behavior: 'instant',
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
    },

    /**
     * Старт: явный выбор в localStorage (`bastyon_locale`) — главный, он уже
     * применён к vue-i18n на буте, ничего не трогаем. Без него — переносим
     * старое значение из IndexedDB (`bastyonAppLanguage`), если оно есть.
     * Раньше IDB-значение (с дефолтом `en`) перебивало выбор в шапке после
     * перезагрузки (V42).
     */
    async loadLanguage(): Promise<void> {
      try {
        if (readStoredLocale()) return
        const stored = await settingsAPI.get(SETTING_KEY_LANGUAGE)
        if ((stored === 'ru' || stored === 'en') && stored !== this.language) {
          this.language = stored
          setI18nLocale(stored)
        }
      } catch (err) {
        console.error('Failed to load language setting:', err)
      } finally {
        this.languageLoaded = true
      }
    },

    /**
     * Меняет язык и персистит в IndexedDB. Синхронизирует vue-i18n и <html lang>.
     */
    async setLanguage(language: AppLanguage): Promise<void> {
      this.language = language
      setI18nLocale(language)
      try {
        await settingsAPI.set(SETTING_KEY_LANGUAGE, language)
      } catch (err) {
        console.error('Failed to save language setting:', err)
      }
    },
  },
})
