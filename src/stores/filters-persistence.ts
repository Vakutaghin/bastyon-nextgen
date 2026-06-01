// Load/save сохраняемой части состояния стора фильтров в IDB settings.

import { settingsAPI } from '@/db/apis/settings-api'
import type { Category } from '@/b-components/sidebar/sidebar-categories/categories-data'
import { FILTERS_SETTINGS_KEY } from './filters-store-consts'

/** Снимок состояния, который персистится. customCategories и selectedTags — массивы. */
export interface FiltersSnapshot {
  selectedCategories: string[]
  customCategories: Category[]
  selectedTags: string[]
  topFirst: boolean
}

/**
 * Загружает сохранённый снимок фильтров из IDB. Обрабатывает legacy `excludedCategories`
 * (после флипа логики просто игнорируется — стартуем с пустыми selectedCategories).
 * Возвращает Partial — поля, которые удалось распарсить.
 */
/** Сырой персистнутый блоб (включая legacy-поля), читаем защитно. */
interface PersistedFilters {
  customCategories?: Category[]
  selectedCategories?: string[]
  excludedCategories?: string[]
  selectedTags?: string[]
  topFirst?: boolean
}

export async function loadFiltersFromSettings(): Promise<Partial<FiltersSnapshot>> {
  try {
    const settings = (await settingsAPI.get(FILTERS_SETTINGS_KEY)) as PersistedFilters | null | undefined
    if (!settings) return {}

    const snapshot: Partial<FiltersSnapshot> = {}

    if (Array.isArray(settings.customCategories)) {
      snapshot.customCategories = settings.customCategories
    }
    if (Array.isArray(settings.selectedCategories)) {
      snapshot.selectedCategories = settings.selectedCategories
    } else if (
      Array.isArray(settings.excludedCategories) &&
      settings.excludedCategories.length > 0
    ) {
      // Legacy "excludedCategories": после флипа логики не мигрируем — стартуем пусто.
      snapshot.selectedCategories = []
    }
    if (Array.isArray(settings.selectedTags)) {
      snapshot.selectedTags = settings.selectedTags
    }
    if (settings.topFirst !== undefined) {
      snapshot.topFirst = settings.topFirst
    }
    return snapshot
  } catch (e) {
    console.error('Failed to load filters settings:', e)
    return {}
  }
}

/** Сохраняет снимок в IDB. Глубокое копирование через JSON, чтобы оторваться от реактивности. */
export async function saveFiltersToSettings(snapshot: FiltersSnapshot): Promise<void> {
  try {
    await settingsAPI.set(FILTERS_SETTINGS_KEY, {
      selectedCategories: JSON.parse(JSON.stringify(snapshot.selectedCategories)),
      customCategories: JSON.parse(JSON.stringify(snapshot.customCategories)),
      selectedTags: JSON.parse(JSON.stringify(snapshot.selectedTags)),
      topFirst: snapshot.topFirst,
    })
  } catch (e) {
    console.error('Failed to save filters settings:', e)
  }
}
