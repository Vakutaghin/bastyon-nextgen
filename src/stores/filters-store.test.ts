// Фильтры ленты: вкладка из ?feedMode, сортировка и окно «Лучшего» по
// фильтрам, свои категории (сохраняются) и временные из тега в посте (живут
// до перезагрузки), теги, «Подписки» недоступны без входа и уводят на ленту
// при выходе. Сохранённый снимок поднимается один раз.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}))
vi.mock('./filters-persistence', () => ({
  loadFiltersFromSettings: mocks.load,
  saveFiltersToSettings: mocks.save,
}))

import { BLOCKS_PER_DAY, DEFAULT_TOP_FEED_DEPTH } from './filters-store-consts'
import { useFiltersStore } from './filters-store'
import { useUIStore } from './ui-store'

const lastSaved = () => mocks.save.mock.lastCall![0]

describe('filters store', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    setActivePinia(createPinia())
    mocks.load.mockReset().mockResolvedValue({})
    mocks.save.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('по умолчанию — лента, за неделю, по популярности', () => {
    const store = useFiltersStore()
    expect(store.activeTab).toBe(1)
    expect(store.tabs.filter((t: { active: boolean }) => t.active)).toHaveLength(1)
    expect(store.orderby).toBe('score')
    expect(store.topFeedDepth).toBe(7 * BLOCKS_PER_DAY)
    expect(store.ascdesc).toBe('desc')
    expect(store.topFirst).toBe(false)
  })

  it('вкладка из ссылки ?feedMode=video', () => {
    window.history.replaceState({}, '', '/?feedMode=video')
    const store = useFiltersStore()
    expect(store.activeTab).toBe(3)
    expect(store.tabs.find((t: { id: number }) => t.id === 3).active).toBe(true)
  })

  it('неизвестный feedMode — обычная лента', () => {
    window.history.replaceState({}, '', '/?feedMode=nonsense')
    expect(useFiltersStore().activeTab).toBe(1)
  })

  it('сортировка и окно «Лучшего» следуют за фильтрами', () => {
    const store = useFiltersStore()
    store.selectSortFilter(2)
    expect(store.orderby).toBe('id')
    store.selectSortFilter(4)
    expect(store.orderby).toBe('comment')
    store.selectTimeFilter(1)
    expect(store.activeTimeFilter).toBe(1)
    expect(store.topFeedDepth).toBe(BLOCKS_PER_DAY)
    store.selectTimeFilter(999)
    expect(store.topFeedDepth).toBe(DEFAULT_TOP_FEED_DEPTH)
  })

  it('init поднимает сохранённое один раз, даже при двух одновременных вызовах', async () => {
    mocks.load.mockResolvedValue({
      selectedCategories: ['custom_кофе'],
      customCategories: [{ id: 'custom_кофе', name: 'Кофе', icon: '⭐', tags: ['кофе'] }],
      selectedTags: ['bastyon'],
      topFirst: true,
    })
    const store = useFiltersStore()
    await Promise.all([store.init(), store.init()])
    await store.init()
    expect(mocks.load).toHaveBeenCalledTimes(1)
    expect(store.selectedCategories).toEqual(['custom_кофе'])
    expect(store.selectedTags).toEqual(['bastyon'])
    expect(store.topFirst).toBe(true)
    expect(store.allCategories[0]?.id).toBe('custom_кофе')
  })

  it('«Сначала лучшее», категории и теги сохраняются при каждом переключении', () => {
    const store = useFiltersStore()
    store.toggleTopFirst()
    expect(lastSaved().topFirst).toBe(true)

    store.toggleCategorySelection('news')
    store.toggleTag('pkoin')
    expect(lastSaved()).toMatchObject({ selectedCategories: ['news'], selectedTags: ['pkoin'] })

    store.toggleCategorySelection('news')
    store.toggleTag('pkoin')
    expect(lastSaved()).toMatchObject({ selectedCategories: [], selectedTags: [] })

    store.toggleCategorySelection('a')
    store.clearCategorySelection()
    expect(lastSaved().selectedCategories).toEqual([])
  })

  it('готовые категории — набор и порядок legacy, теги на языке ленты', () => {
    const store = useFiltersStore()
    const ui = useUIStore()
    ui.language = 'ru'
    expect(store.allCategories.map((c) => c.id)).toEqual([
      'c2',
      'c3',
      'c4',
      'c5',
      'c55',
      'c6',
      'c63',
      'c72',
      'c7',
      'c71',
      'c8',
      'c9',
      'c11',
      'c12',
      'c13',
      'c14',
      'c15',
      'c16',
      'c17',
      'c18',
    ])
    const tagsOf = (id: string) => store.allCategories.find((c) => c.id === id)?.tags
    // Нижний регистр: нода сравнивает теги с учётом регистра.
    expect(tagsOf('c4')).toEqual(['криптовалюта'])
    expect(tagsOf('c8')).toEqual(['спорт'])
    ui.language = 'en'
    expect(tagsOf('c8')).toEqual(['sports'])
    ui.language = 'de'
    expect(tagsOf('c8')).toEqual(['sport'])
    // У legacy китайские теги под ключом cmn, а язык — zh: берутся английские.
    ui.language = 'zh'
    expect(tagsOf('c2')).toEqual(['funny', 'memes'])
    // Свой язык у ленты: теги — на нём, язык интерфейса не важен.
    ui.language = 'ru'
    ui.setFeedLanguage('en')
    expect(tagsOf('c8')).toEqual(['sports'])
  })

  it('выбранный раньше «Космос» становится своей категорией с тегом «космос»', async () => {
    mocks.load.mockResolvedValue({ selectedCategories: ['c4', 'c10'] })
    const store = useFiltersStore()
    await store.init()
    expect(store.customCategories).toEqual([
      { id: 'custom_космос', name: 'Космос', icon: '⭐', tags: ['космос'] },
    ])
    expect(store.selectedCategories).toEqual(['c4', 'custom_космос'])
    expect(lastSaved().selectedCategories).toEqual(['c4', 'custom_космос'])
  })

  it('своя категория: id в нижнем регистре, имя как ввели, сразу выбрана, без дублей', () => {
    const store = useFiltersStore()
    store.addCustomCategory('Кофе')
    store.addCustomCategory('кофе')
    expect(store.customCategories).toEqual([
      { id: 'custom_кофе', name: 'Кофе', icon: '⭐', tags: ['кофе'] },
    ])
    expect(store.selectedCategories).toEqual(['custom_кофе'])
    expect(lastSaved().customCategories).toHaveLength(1)
  })

  it('тег из поста: есть подходящая категория — выбирается она, иначе временная', () => {
    const store = useFiltersStore()
    const existing = store.allCategories.find((c) => c.tags.length > 0)!
    store.addTemporaryCategory(existing.tags[0]!.toUpperCase())
    expect(store.temporaryCategories).toEqual([])
    expect(store.selectedCategories).toEqual([existing.id])

    store.addTemporaryCategory('ЗимнийКемпинг')
    expect(store.temporaryCategories[0]).toMatchObject({
      id: 'temp_зимнийкемпинг',
      icon: '⚡',
      tags: ['зимнийкемпинг'],
    })
    expect(store.selectedCategories).toContain('temp_зимнийкемпинг')
    expect(store.allCategories[0]?.id).toBe('temp_зимнийкемпинг')
    // Временные категории на диск не пишутся.
    expect(lastSaved().customCategories).toEqual([])
  })

  it('удаление категории снимает и выбор', () => {
    const store = useFiltersStore()
    store.addCustomCategory('Кофе')
    store.addTemporaryCategory('чай')
    store.removeCustomCategory('custom_кофе')
    store.removeCustomCategory('temp_чай')
    expect(store.customCategories).toEqual([])
    expect(store.temporaryCategories).toEqual([])
    expect(store.selectedCategories).toEqual([])
  })

  it('выход на вкладке «Подписки» уводит на ленту и выключает вкладку', () => {
    const store = useFiltersStore()
    store.updateTabsAvailability(true)
    store.selectTab(2)
    expect(store.activeTab).toBe(2)

    store.updateTabsAvailability(false)
    expect(store.activeTab).toBe(1)
    expect(store.tabs.find((t: { id: number }) => t.id === 2).disabled).toBe(true)

    store.updateTabsAvailability(true)
    expect(store.tabs.find((t: { id: number }) => t.id === 2).disabled).toBe(false)
  })
})
