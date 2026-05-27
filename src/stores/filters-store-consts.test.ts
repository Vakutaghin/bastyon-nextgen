import { describe, it, expect } from 'vitest'
import {
  FEED_MODE_TO_TAB_ID,
  SORT_FILTER_MAP,
  CUSTOM_CATEGORY_PREFIX,
  TEMP_CATEGORY_PREFIX,
} from './filters-store-consts'

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

  it('has distinct category prefixes', () => {
    expect(CUSTOM_CATEGORY_PREFIX).not.toBe(TEMP_CATEGORY_PREFIX)
    expect(CUSTOM_CATEGORY_PREFIX).toBe('custom_')
    expect(TEMP_CATEGORY_PREFIX).toBe('temp_')
  })
})
