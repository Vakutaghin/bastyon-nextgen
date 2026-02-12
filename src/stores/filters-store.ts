import { defineStore } from 'pinia'
import { filtersData } from '@/b-components/sidebar/filters-data'
import { tabsData } from '@/b-components/sidebar/sidebar-tabs/tabs-data'
import { categoriesData, type Category } from '@/b-components/sidebar/sidebar-categories/categories-data'
import { settingsAPI } from '@/db'


export const useFiltersStore = defineStore('filters', {
  state: () => {
    // Определяем начальный таб из URL
    const urlParams = new URLSearchParams(window.location.search)
    const feedMode = urlParams.get('feedMode')

    // Дефолтный таб
    let initialTabId = tabsData.find((tab: any) => tab.active)?.id || tabsData[0]?.id || 1

    // Маппинг feedMode на id табов
    if (feedMode === 'subscriptions') initialTabId = 2
    else if (feedMode === 'video') initialTabId = 3
    else if (feedMode === 'audio') initialTabId = 4
    else if (feedMode === 'article') initialTabId = 5
    else if (feedMode === 'favorites') initialTabId = 6
    else if (feedMode === 'discussed') initialTabId = 7
    else if (feedMode === 'all') initialTabId = 1

    // Подготавливаем табы с правильным активным состоянием
    const initialTabs = JSON.parse(JSON.stringify(tabsData))
    initialTabs.forEach((tab: any) => {
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
      topFirst: true,
      isInitialized: false,
      isInitializing: false
    }
  },

  getters: {
    /**
     * Получает полный список категорий (статические + кастомные + временные)
     * Кастомные и временные выводятся сверху
     */
    allCategories(): Category[] {
      // Объединяем списки, исключая дубликаты по ID
      const all = [
        ...this.temporaryCategories,
        ...this.customCategories,
        ...categoriesData
      ]

      // Убираем дубликаты (если вдруг временная категория совпадает с кастомной или статической)
      const unique = new Map()
      all.forEach(cat => {
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
      const active = this.timeFilters.find((filter: any) => filter.active)
      return active?.id || null
    },

    /**
     * Получает активный фильтр сортировки
     */
    activeSortFilter(): string | number | null {
      const active = this.sortFilters.find((filter: any) => filter.active)
      return active?.id || null
    },

    /**
     * Получает значение orderby для активного фильтра сортировки
     * Маппинг фильтров:
     * - id: 1 (По популярности) -> 'score'
     * - id: 2 (По дате) -> 'id'
     * - id: 3 (По рейтингу) -> 'score'
     * - id: 4 (По комментариям) -> 'comment'
     */
    orderby(): string {
      const activeId = this.activeSortFilter
      const mapping: Record<number, string> = {
        1: 'score',    // По популярности
        2: 'id',       // По дате
        3: 'score',    // По рейтингу
        4: 'comment'   // По комментариям
      }
      return mapping[activeId as number] || 'score'
    },

    /**
     * Получает направление сортировки (ascdesc)
     * По умолчанию 'desc' для всех фильтров
     */
    ascdesc(): 'asc' | 'desc' {
      return 'desc'
    }
  },

  actions: {
    /**
     * Инициализация настроек из IndexedDB
     */
    async init() {
      if (this.isInitialized || (this as any).isInitializing) return
      (this as any).isInitializing = true

      try {
        const settings = await settingsAPI.get('sidebarFilters')
        if (settings) {
          // Загружаем кастомные категории
          if (Array.isArray(settings.customCategories)) {
            this.customCategories = settings.customCategories
          }

          if (Array.isArray(settings.selectedCategories)) {
            this.selectedCategories = settings.selectedCategories
          }

          // Backward compatibility for old "excludedCategories"
          else if (Array.isArray(settings.excludedCategories) && settings.excludedCategories.length > 0) {
             // If we had excluded categories, we might want to clear them or migrate logic.
             // But since logic flipped, it's safer to just start empty or interpret differently.
             // Let's just ignore old excluded categories to avoid confusion.
             this.selectedCategories = []
          }

          if (Array.isArray(settings.selectedTags)) {
            this.selectedTags = settings.selectedTags
          }
          if (settings.topFirst !== undefined) {
            this.topFirst = settings.topFirst
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      } finally {
        this.isInitialized = true;
        (this as any).isInitializing = false
      }
    },

    /**
     * Сохранение настроек в IndexedDB
     */
    async saveSettings() {
      try {
        await settingsAPI.set('sidebarFilters', {
          selectedCategories: JSON.parse(JSON.stringify(this.selectedCategories)),
          customCategories: JSON.parse(JSON.stringify(this.customCategories)), // Сохраняем кастомные
          selectedTags: JSON.parse(JSON.stringify(this.selectedTags)),
          topFirst: this.topFirst
        })
      } catch (e) {
        console.error('Failed to save settings:', e)
      }
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
      this.timeFilters.forEach((filter: any) => {
        filter.active = filter.id === filterId
      })
    },

    /**
     * Выбирает фильтр сортировки
     */
    selectSortFilter(filterId: string | number): void {
      this.sortFilters.forEach((filter: any) => {
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
      this.tabs.forEach((tab: any) => {
        tab.active = tab.id === tabId
      })
      this.activeTab = tabId
    },

    /**
     * Обновляет доступность табов в зависимости от авторизации
     */
    updateTabsAvailability(isAuthorized: boolean): void {
      const subsTab = this.tabs.find((tab: any) => tab.id === 2)
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
      if (!this.customCategories.some(c => c.id === id)) {
        const newCategory: Category = {
          id,
          name: tag, // Используем введенное имя как есть (с регистром)
          icon: '⭐', // Иконка для кастомных категорий
          tags: [tag.toLowerCase()]
        }

        this.customCategories.unshift(newCategory) // Добавляем в начало
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
      this.customCategories = this.customCategories.filter(c => c.id !== categoryId)
      this.temporaryCategories = this.temporaryCategories.filter(c => c.id !== categoryId)
      // Также убираем из выбранных, если была выбрана
      this.selectedCategories = this.selectedCategories.filter(id => id !== categoryId)
      this.saveSettings()
    },

    /**
     * Добавляет временную категорию (при клике из поста)
     * Она стирается при перезагрузке страницы (не сохраняется в IDB)
     */
    addTemporaryCategory(tag: string) {
      const id = `temp_${tag.toLowerCase()}`

      // Проверяем, есть ли уже такая категория (любого типа)
      const exists = this.allCategories.some(c => c.tags.includes(tag.toLowerCase()))

      if (exists) {
        // Если категория уже есть (статическая или кастомная), просто выбираем её
        // Находим ID этой категории
        const existingCat = this.allCategories.find(c => c.tags.includes(tag.toLowerCase()))
        if (existingCat && !this.selectedCategories.includes(existingCat.id)) {
          this.selectedCategories.push(existingCat.id)
          this.saveSettings()
        }
        return
      }

      // Если нет, создаем временную
      const newCategory: Category = {
        id,
        name: tag,
        icon: '⚡', // Иконка для временных категорий
        tags: [tag.toLowerCase()]
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
      this.timeFilters.forEach((filter: any, index: number) => {
        filter.active = index === 0
      })
      this.sortFilters.forEach((filter: any, index: number) => {
        filter.active = index === 0
      })
    }
  }
})
