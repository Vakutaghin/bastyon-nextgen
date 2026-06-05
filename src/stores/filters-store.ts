import { defineStore } from 'pinia'
import { filtersData } from '@/b-components/sidebar/filters-data'
import { tabsData } from '@/b-components/sidebar/sidebar-tabs/tabs-data'
import {
  categoriesData,
  type Category,
} from '@/b-components/sidebar/sidebar-categories/categories-data'

// Локальные типы, синхронизированные с формой tabsData / filtersData.
// Когда сами *-data.ts получат свои интерфейсы — удалить отсюда.
interface FeedTab {
  id: number
  labelKey: string
  icon: string
  active: boolean
  disabled: boolean
}
interface FeedFilter {
  id: number
  labelKey: string
  active: boolean
}
import {
  FEED_MODE_TO_TAB_ID,
  SORT_FILTER_MAP,
  TIME_FILTER_DEPTH_MAP,
  DEFAULT_TOP_FEED_DEPTH,
  CUSTOM_CATEGORY_ICON,
  TEMP_CATEGORY_ICON,
} from './filters-store-consts'
import { loadFiltersFromSettings, saveFiltersToSettings } from './filters-persistence'

export const useFiltersStore = defineStore('filters', {
  state: () => {
    // Определяем начальный таб из URL ?feedMode=…
    const urlParams = new URLSearchParams(window.location.search)
    const feedMode = urlParams.get('feedMode')

    // Дефолтный таб — либо помеченный active в tabsData, либо первый, либо id=1.
    const fromUrl = feedMode ? FEED_MODE_TO_TAB_ID[feedMode] : undefined
    const initialTabId =
      fromUrl ?? (tabsData.find((tab: FeedTab) => tab.active)?.id || tabsData[0]?.id || 1)

    // Подготавливаем табы с правильным активным состоянием
    const initialTabs = JSON.parse(JSON.stringify(tabsData))
    initialTabs.forEach((tab: FeedTab) => {
      tab.active = tab.id === initialTabId
    })

    return {
      timeFilters: JSON.parse(JSON.stringify(filtersData.timeFilters)),
      sortFilters: JSON.parse(JSON.stringify(filtersData.sortFilters)),
      activeTab: initialTabId as number | string,
      tabs: initialTabs,
      selectedCategories: [] as string[],
      customCategories: [] as Category[], // Кастомные категории (сохраняются в IDB, создаются пользователем вручную)
      temporaryCategories: [] as Category[], // Временные категории (не сохраняются в IDB, создаются при клике на тег в посте, живут до перезагрузки)
      selectedTags: [] as string[],
      // Дефолт OFF: главная лента остаётся проверенной gethierarchicalstrip
      // (хронологическая). Включение тоггла «Сначала лучшее» переводит её на
      // gettopfeed (лента «Лучшее») — opt-in, без сюрприза в дефолтном UX.
      topFirst: false,
      isInitialized: false,
      isInitializing: false,
    }
  },

  getters: {
    /**
     * Получает полный список категорий (статические + кастомные + временные)
     * Кастомные и временные выводятся сверху
     */
    allCategories(): Category[] {
      // Объединяем списки, исключая дубликаты по ID
      const all = [...this.temporaryCategories, ...this.customCategories, ...categoriesData]

      // Убираем дубликаты (если вдруг временная категория совпадает с кастомной или статической)
      const unique = new Map()
      all.forEach((cat) => {
        if (!unique.has(cat.id)) {
          unique.set(cat.id, cat)
        }
      })

      return Array.from(unique.values())
    },

    /**
     * Получает активный фильтр времени
     */
    activeTimeFilter(): string | number | null {
      const active = this.timeFilters.find((filter: FeedFilter) => filter.active)
      return active?.id || null
    },

    /**
     * Получает активный фильтр сортировки
     */
    activeSortFilter(): string | number | null {
      const active = this.sortFilters.find((filter: FeedFilter) => filter.active)
      return active?.id || null
    },

    /** Значение orderby для активного фильтра сортировки (см. SORT_FILTER_MAP). */
    orderby(): string {
      return SORT_FILTER_MAP[this.activeSortFilter as number] || 'score'
    },

    /**
     * Окно `depth` (в днях) для ленты «Лучшее» (`gettopfeed`), выведенное из
     * активного фильтра времени. Используется только когда включён `topFirst`.
     */
    topFeedDepth(): number {
      return TIME_FILTER_DEPTH_MAP[this.activeTimeFilter as number] ?? DEFAULT_TOP_FEED_DEPTH
    },

    /**
     * Получает направление сортировки (ascdesc)
     * По умолчанию 'desc' для всех фильтров
     */
    ascdesc(): 'asc' | 'desc' {
      return 'desc'
    },
  },

  actions: {
    /**
     * Инициализация настроек из IndexedDB
     */
    async init() {
      if (this.isInitialized || this.isInitializing) return
      this.isInitializing = true

      const snapshot = await loadFiltersFromSettings()
      if (snapshot.customCategories) this.customCategories = snapshot.customCategories
      if (snapshot.selectedCategories) this.selectedCategories = snapshot.selectedCategories
      if (snapshot.selectedTags) this.selectedTags = snapshot.selectedTags
      if (snapshot.topFirst !== undefined) this.topFirst = snapshot.topFirst

      this.isInitialized = true
      this.isInitializing = false
    },

    /** Сохранение настроек в IndexedDB. */
    async saveSettings() {
      await saveFiltersToSettings({
        selectedCategories: this.selectedCategories,
        customCategories: this.customCategories,
        selectedTags: this.selectedTags,
        topFirst: this.topFirst,
      })
    },

    /**
     * Переключает режим "Сначала лучшее"
     */
    toggleTopFirst() {
      this.topFirst = !this.topFirst
      this.saveSettings()
    },

    /**
     * Выбирает фильтр времени
     */
    selectTimeFilter(filterId: string | number): void {
      this.timeFilters.forEach((filter: FeedFilter) => {
        filter.active = filter.id === filterId
      })
    },

    /**
     * Выбирает фильтр сортировки
     */
    selectSortFilter(filterId: string | number): void {
      this.sortFilters.forEach((filter: FeedFilter) => {
        filter.active = filter.id === filterId
      })
    },

    /**
     * Переключает выбор категории
     */
    toggleCategorySelection(categoryId: string): void {
      const index = this.selectedCategories.indexOf(categoryId)
      if (index === -1) {
        this.selectedCategories.push(categoryId)
      } else {
        this.selectedCategories.splice(index, 1)
      }
      this.saveSettings()
    },

    /**
     * Очищает выбор категорий (все выключены)
     */
    clearCategorySelection(): void {
      this.selectedCategories = []
      this.saveSettings()
    },

    /**
     * Переключает выбор тега
     */
    toggleTag(tagName: string): void {
      const index = this.selectedTags.indexOf(tagName)
      if (index === -1) {
        this.selectedTags.push(tagName)
      } else {
        this.selectedTags.splice(index, 1)
      }
      this.saveSettings()
    },

    /**
     * Выбирает таб
     */
    selectTab(tabId: string | number): void {
      this.tabs.forEach((tab: FeedTab) => {
        tab.active = tab.id === tabId
      })
      this.activeTab = tabId
    },

    /**
     * Обновляет доступность табов в зависимости от авторизации
     */
    updateTabsAvailability(isAuthorized: boolean): void {
      const subsTab = this.tabs.find((tab: FeedTab) => tab.id === 2)
      if (subsTab) {
        subsTab.disabled = !isAuthorized

        // Если мы были на вкладке подписок и разлогинились - переходим на ленту
        if (subsTab.disabled && this.activeTab === 2) {
          this.selectTab(1)
        }
      }
    },

    /**
     * Добавляет кастомную категорию
     * @param tag Название тега/категории
     */
    addCustomCategory(tag: string) {
      const id = `custom_${tag.toLowerCase()}`

      // Проверяем, существует ли уже такая категория
      if (!this.customCategories.some((c) => c.id === id)) {
        const newCategory: Category = {
          id,
          name: tag, // оставляем введённое имя как есть (с регистром)
          icon: CUSTOM_CATEGORY_ICON,
          tags: [tag.toLowerCase()],
        }
        this.customCategories.unshift(newCategory)
      }

      // Автоматически выбираем добавленную категорию
      if (!this.selectedCategories.includes(id)) {
        this.selectedCategories.push(id)
      }

      this.saveSettings()
    },

    /**
     * Удаляет кастомную или временную категорию
     */
    removeCustomCategory(categoryId: string) {
      this.customCategories = this.customCategories.filter((c) => c.id !== categoryId)
      this.temporaryCategories = this.temporaryCategories.filter((c) => c.id !== categoryId)
      // Также убираем из выбранных, если была выбрана
      this.selectedCategories = this.selectedCategories.filter((id) => id !== categoryId)
      this.saveSettings()
    },

    /**
     * Добавляет временную категорию (при клике из поста)
     * Она стирается при перезагрузке страницы (не сохраняется в IDB)
     */
    addTemporaryCategory(tag: string) {
      const id = `temp_${tag.toLowerCase()}`

      // Проверяем, есть ли уже такая категория (любого типа)
      const exists = this.allCategories.some((c) => c.tags.includes(tag.toLowerCase()))

      if (exists) {
        // Если категория уже есть (статическая или кастомная), просто выбираем её
        // Находим ID этой категории
        const existingCat = this.allCategories.find((c) => c.tags.includes(tag.toLowerCase()))
        if (existingCat && !this.selectedCategories.includes(existingCat.id)) {
          this.selectedCategories.push(existingCat.id)
          this.saveSettings()
        }
        return
      }

      // Если нет, создаём временную
      const newCategory: Category = {
        id,
        name: tag,
        icon: TEMP_CATEGORY_ICON,
        tags: [tag.toLowerCase()],
      }

      this.temporaryCategories.unshift(newCategory)

      // И сразу выбираем её
      if (!this.selectedCategories.includes(id)) {
        this.selectedCategories.push(id)
        this.saveSettings()
      }
    },

    /**
     * Сбрасывает все фильтры
     */
    resetFilters(): void {
      this.timeFilters.forEach((filter: FeedFilter, index: number) => {
        filter.active = index === 0
      })
      this.sortFilters.forEach((filter: FeedFilter, index: number) => {
        filter.active = index === 0
      })
    },
  },
})
