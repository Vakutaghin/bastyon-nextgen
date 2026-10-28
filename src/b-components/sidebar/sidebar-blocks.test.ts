// Скрытый блок левой панели не действует: выбранное в нём сбрасывается, а
// остальное не трогается.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/stores/filters-persistence', () => ({
  loadFiltersFromSettings: vi.fn(async () => ({})),
  saveFiltersToSettings: vi.fn(async () => {}),
}))
vi.mock('./sidebar-categories/sidebar-categories.vue', () => ({ default: {} }))
vi.mock('./sidebar-feed-settings/sidebar-feed-settings.vue', () => ({ default: {} }))
vi.mock('./sidebar-tags/sidebar-tags.vue', () => ({ default: {} }))

import { useFiltersStore } from '@/stores/filters-store'
import { useUIStore } from '@/stores/ui-store'
import { resetSidebarBlock } from './sidebar-blocks'

describe('resetSidebarBlock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const filters = useFiltersStore()
    filters.selectedCategories = ['games']
    filters.selectedTags = ['bastyon']
    filters.topFirst = true
    useUIStore().setFeedLanguage('de')
  })

  it('категории — только выбор категорий', () => {
    resetSidebarBlock('categories')
    const filters = useFiltersStore()
    expect(filters.selectedCategories).toEqual([])
    expect(filters.selectedTags).toEqual(['bastyon'])
    expect(filters.topFirst).toBe(true)
  })

  it('теги — только выбор тегов', () => {
    resetSidebarBlock('tags')
    const filters = useFiltersStore()
    expect(filters.selectedTags).toEqual([])
    expect(filters.selectedCategories).toEqual(['games'])
  })

  it('«Сначала лучшее» и язык ленты — обычный порядок и язык интерфейса', () => {
    const ui = useUIStore()
    expect(ui.contentLanguage).toBe('de')
    resetSidebarBlock('feedSettings')
    expect(useFiltersStore().topFirst).toBe(false)
    expect(ui.contentLanguage).toBe(ui.language)
    expect(useFiltersStore().selectedCategories).toEqual(['games'])
  })
})
