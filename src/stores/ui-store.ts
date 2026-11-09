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
/**
 * Языки ленты, если они не как у интерфейса, — через запятую («ru,en»; раньше
 * там был один язык, он читается так же). В localStorage: первый запрос
 * ленты — сразу на них.
 */
const FEED_LANGUAGE_STORAGE_KEY = 'bastyon_feed_locale'

/** Поддерживаемые, без повторов, в порядке списка языков. */
function normalizeLanguages(list: readonly unknown[]): AppLanguage[] {
  return SUPPORTED_LOCALES.filter((lang) => list.includes(lang))
}

function readStoredFeedLanguages(): AppLanguage[] {
  try {
    return normalizeLanguages((localStorage.getItem(FEED_LANGUAGE_STORAGE_KEY) ?? '').split(','))
  } catch {
    return []
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
    /** Языки ленты; пусто — как у интерфейса. */
    feedLanguages: readStoredFeedLanguages(),
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

    /** На каких языках лента: свои языки ленты, иначе — язык интерфейса. */
    contentLanguages(): AppLanguage[] {
      return this.feedLanguages.length ? this.feedLanguages : [this.language]
    },

    /**
     * Главный язык ленты — для того, что нода отдаёт на одном языке:
     * продвигаемые посты, теги, категории, «Кого читать», комментарии. Язык
     * интерфейса, если он среди языков ленты, иначе первый из них.
     */
    contentLanguage(): AppLanguage {
      const langs = this.contentLanguages
      return langs.includes(this.language) ? this.language : langs[0]!
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
     * Языки ленты — отдельно от языка интерфейса. Пусто или один язык
     * интерфейса — «как у интерфейса»: тогда лента идёт за ним и дальше.
     */
    setFeedLanguages(languages: readonly AppLanguage[]): void {
      const list = normalizeLanguages(languages)
      const next = list.length === 1 && list[0] === this.language ? [] : list
      this.feedLanguages = next
      try {
        if (next.length) localStorage.setItem(FEED_LANGUAGE_STORAGE_KEY, next.join(','))
        else localStorage.removeItem(FEED_LANGUAGE_STORAGE_KEY)
      } catch {
        // Без localStorage фильтр живёт до перезапуска.
      }
    },

    /** Один язык ленты; null — как у интерфейса. */
    setFeedLanguage(language: AppLanguage | null): void {
      this.setFeedLanguages(language ? [language] : [])
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
