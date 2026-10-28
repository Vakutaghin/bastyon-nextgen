import { defineStore } from 'pinia'
import { SCROLL_POSITION_PREFIX } from '@/blockchain/constants/storage'
import { settingsAPI } from '@/db/apis/settings-api'
import {
  SUPPORTED_LOCALES,
  detectInitialLocale,
  loadLocaleMessages,
  readStoredLocale,
  setI18nLocale,
  type Locale,
} from '@/i18n'

export type AppLanguage = Locale

const SETTING_KEY_LANGUAGE = 'bastyonAppLanguage'
/** Язык ленты, если он не как у интерфейса. В localStorage: первый запрос ленты — сразу на нём. */
const FEED_LANGUAGE_STORAGE_KEY = 'bastyon_feed_locale'

function readStoredFeedLanguage(): AppLanguage | null {
  try {
    const stored = localStorage.getItem(FEED_LANGUAGE_STORAGE_KEY)
    return (SUPPORTED_LOCALES as readonly unknown[]).includes(stored)
      ? (stored as AppLanguage)
      : null
  } catch {
    return null
  }
}

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
    /** Фильтр языка ленты; null — как у интерфейса. */
    feedLanguage: readStoredFeedLanguage(),
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

    /**
     * Язык контента: лента, продвигаемые посты, теги, «Кого читать». Свой
     * фильтр у ленты, иначе — язык интерфейса.
     */
    contentLanguage(): AppLanguage {
      return this.feedLanguage ?? this.language
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
        const known = (SUPPORTED_LOCALES as readonly unknown[]).includes(stored)
        if (known && stored !== this.language) {
          const language = stored as AppLanguage
          await loadLocaleMessages(language)
          this.language = language
          setI18nLocale(language)
        }
      } catch (err) {
        console.error('Failed to load language setting:', err)
      } finally {
        this.languageLoaded = true
      }
    },

    /**
     * Фильтр языка ленты — отдельно от языка интерфейса. Язык интерфейса или
     * null — «как у интерфейса»: тогда лента идёт за ним и дальше.
     */
    setFeedLanguage(language: AppLanguage | null): void {
      const next = language && language !== this.language ? language : null
      this.feedLanguage = next
      try {
        if (next) localStorage.setItem(FEED_LANGUAGE_STORAGE_KEY, next)
        else localStorage.removeItem(FEED_LANGUAGE_STORAGE_KEY)
      } catch {
        // Без localStorage фильтр живёт до перезапуска.
      }
    },

    /**
     * Меняет язык и персистит в IndexedDB. Синхронизирует vue-i18n и <html lang>.
     * Фильтр языка ленты сбрасывается на этот же язык.
     */
    async setLanguage(language: AppLanguage): Promise<void> {
      try {
        await loadLocaleMessages(language)
      } catch (err) {
        // Словарь не загрузился (офлайн) — язык не переключаем, иначе вместо
        // текстов был бы английский запасной.
        console.error('Failed to load language:', err)
        return
      }
      this.language = language
      setI18nLocale(language)
      // Сменили язык интерфейса — лента переключается на него же. Обратно
      // не работает: фильтр ленты язык интерфейса не трогает.
      this.setFeedLanguage(null)
      try {
        await settingsAPI.set(SETTING_KEY_LANGUAGE, language)
      } catch (err) {
        console.error('Failed to save language setting:', err)
      }
    },
  },
})
