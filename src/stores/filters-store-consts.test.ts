import { describe, it, expect } from 'vitest'
import {
  FEED_MODE_TO_TAB_ID,
  SORT_FILTER_MAP,
  TIME_FILTER_DEPTH_MAP,
  DEFAULT_TOP_FEED_DEPTH,
  BLOCKS_PER_DAY,
  CUSTOM_CATEGORY_PREFIX,
  TEMP_CATEGORY_PREFIX,
} from './filters-store-consts'
import { filtersData } from '@/b-components/sidebar/filters-data'

describe('filters-store-consts', () => {
  it('maps all feed modes to tab IDs', () => {
    expect(FEED_MODE_TO_TAB_ID.subscriptions).toBe(2)
    expect(FEED_MODE_TO_TAB_ID.video).toBe(3)
    expect(FEED_MODE_TO_TAB_ID.audio).toBe(4)
    expect(FEED_MODE_TO_TAB_ID.article).toBe(5)
    expect(FEED_MODE_TO_TAB_ID.favorites).toBe(6)
    expect(FEED_MODE_TO_TAB_ID.discussed).toBe(7)
    expect(FEED_MODE_TO_TAB_ID.all).toBe(1)
  })

  it('maps sort filter IDs to API values', () => {
    // 1 По популярности, 2 По дате, 3 По рейтингу, 4 По комментариям.
    expect(SORT_FILTER_MAP[1]).toBe('score')
    expect(SORT_FILTER_MAP[2]).toBe('id')
    expect(SORT_FILTER_MAP[3]).toBe('score')
    expect(SORT_FILTER_MAP[4]).toBe('comment')
  })

  it('measures top-feed depth in blocks, not days (V33)', () => {
    // Нода считает depth блоками: сутки — 1440, неделя — 10080. Сутки «в днях»
    // (1) отдавали бы минуту цепочки, а месяц (43200 блоков) нода не успевает
    // посчитать и отвечает `sql request timeout`.
    expect(BLOCKS_PER_DAY).toBe(1440)
    expect(TIME_FILTER_DEPTH_MAP[1]).toBe(1440)
    expect(TIME_FILTER_DEPTH_MAP[2]).toBe(4320)
    expect(TIME_FILTER_DEPTH_MAP[3]).toBe(10080)
    expect(DEFAULT_TOP_FEED_DEPTH).toBe(10080)
    // Ни одно окно не выходит за предел, который нода успевает посчитать.
    for (const depth of Object.values(TIME_FILTER_DEPTH_MAP)) {
      expect(depth).toBeLessThanOrEqual(10080)
    }
  })

  it('offers only time windows the node can serve (V33)', () => {
    const ids = filtersData.timeFilters.map((f) => f.id)
    expect(ids).toEqual([1, 2, 3])
    // Каждому пункту UI соответствует окно, иначе фильтр молча падал бы в дефолт.
    for (const id of ids) {
      expect(TIME_FILTER_DEPTH_MAP[id as number]).toBeGreaterThan(0)
    }
    expect(filtersData.timeFilters.filter((f) => f.active)).toHaveLength(1)
  })

  it('has distinct category prefixes', () => {
    expect(CUSTOM_CATEGORY_PREFIX).not.toBe(TEMP_CATEGORY_PREFIX)
    expect(CUSTOM_CATEGORY_PREFIX).toBe('custom_')
    expect(TEMP_CATEGORY_PREFIX).toBe('temp_')
  })
})
