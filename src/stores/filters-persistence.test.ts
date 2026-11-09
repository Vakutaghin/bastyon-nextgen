// Сохранение фильтров ленты в IDB settings (настоящая Dexie поверх
// fake-indexeddb): круговой путь, реактивное состояние стора, legacy
// excludedCategories, битые поля и сбои базы — без исключений наружу.

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { db, resetDbAvailabilityForTests } from '@/db/database'
import { settingsAPI } from '@/db/apis/settings-api'
import { FILTERS_SETTINGS_KEY } from './filters-store-consts'
import {
  loadFiltersFromSettings,
  saveFiltersToSettings,
  type FiltersSnapshot,
} from './filters-persistence'

function snapshot(over: Partial<FiltersSnapshot> = {}): FiltersSnapshot {
  return {
    selectedCategories: ['c1', 'c3'],
    customCategories: [{ id: 'custom-1', name: 'bitcoin', icon: 'tag', tags: ['bitcoin', 'btc'] }],
    selectedTags: ['news'],
    topFirst: true,
    liveFeed: false,
    minReputation: 50,
    ...over,
  }
}

describe('filters-persistence', () => {
  beforeEach(async () => {
    resetDbAvailabilityForTests()
    await db.settings.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ничего не сохранено — пустой снимок (стор берёт свои дефолты)', async () => {
    expect(await loadFiltersFromSettings()).toEqual({})
  })

  it('сохранённое читается обратно целиком', async () => {
    const s = snapshot()
    await saveFiltersToSettings(s)
    expect(await loadFiltersFromSettings()).toEqual(s)
  })

  it('реактивное состояние стора сохраняется (Proxy не ломает запись в IDB)', async () => {
    const state = reactive(snapshot({ minReputation: null, liveFeed: true }))
    await saveFiltersToSettings(state)
    // Правка состояния после сохранения не должна просочиться в сохранённое.
    state.selectedTags.push('later')
    expect(await loadFiltersFromSettings()).toEqual(
      snapshot({ minReputation: null, liveFeed: true })
    )
  })

  it('«любая репутация» (null) сохраняется как null, а не теряется', async () => {
    await saveFiltersToSettings(snapshot({ minReputation: null }))
    const loaded = await loadFiltersFromSettings()
    expect(loaded).toHaveProperty('minReputation', null)
  })

  describe('legacy и битые данные', () => {
    it('старые excludedCategories не инвертируются — стартуем с пустого выбора', async () => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, { excludedCategories: ['c1', 'c2'] })
      expect(await loadFiltersFromSettings()).toEqual({ selectedCategories: [] })
    })

    it('пустые excludedCategories — выбор категорий не трогается', async () => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, { excludedCategories: [] })
      expect(await loadFiltersFromSettings()).not.toHaveProperty('selectedCategories')
    })

    it('новый selectedCategories важнее legacy-поля', async () => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, {
        selectedCategories: ['c5'],
        excludedCategories: ['c1'],
      })
      expect(await loadFiltersFromSettings()).toEqual({ selectedCategories: ['c5'] })
    })

    it('поля неверного типа отбрасываются, годные — остаются', async () => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, {
        customCategories: 'oops',
        selectedCategories: { 0: 'c1' },
        selectedTags: ['ok'],
        liveFeed: 'yes',
        topFirst: 'false',
        minReputation: 'high',
      })
      expect(await loadFiltersFromSettings()).toEqual({ selectedTags: ['ok'] })
    })

    it.each([NaN, Infinity])('нечисловая репутация (%s) отбрасывается', async (minReputation) => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, { minReputation })
      expect(await loadFiltersFromSettings()).toEqual({})
    })

    it('вместо объекта — строка: пустой снимок, без исключения', async () => {
      await settingsAPI.set(FILTERS_SETTINGS_KEY, 'garbage')
      expect(await loadFiltersFromSettings()).toEqual({})
    })
  })

  describe('сбои хранилища', () => {
    it('чтение бросило — пустой снимок, а не падение стора', async () => {
      vi.spyOn(settingsAPI, 'get').mockRejectedValue(new Error('IDB gone'))
      expect(await loadFiltersFromSettings()).toEqual({})
    })

    it('запись бросила — сохранение тихо проглатывает ошибку', async () => {
      vi.spyOn(settingsAPI, 'set').mockRejectedValue(new Error('QuotaExceededError'))
      await expect(saveFiltersToSettings(snapshot())).resolves.toBeUndefined()
    })
  })
})
