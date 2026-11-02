// «Новое от подписок»: что человек уже видел — диапазон id, как sharesObserver
// старого клиента; непросмотренное — новее или старше него.

import { beforeEach, describe, expect, it } from 'vitest'

import {
  HIGHLIGHT_MAX_AGE_MS,
  loadSeen,
  recentPosts,
  saveSeen,
  unseenPosts,
  widenSeen,
} from './subscription-highlights'

const posts = (...ids: number[]) => ids.map((id) => ({ id }))

describe('посты подписок: что уже видели', () => {
  beforeEach(() => localStorage.clear())

  it('ничего не видели — показываем все', () => {
    expect(unseenPosts(posts(30, 20, 10), null)).toHaveLength(3)
  })

  it('видели 10…20 — показываем новее и старше', () => {
    const seen = { first: 20, last: 10 }
    expect(unseenPosts(posts(25, 20, 15, 10, 5), seen).map((p) => p.id)).toEqual([25, 5])
  })

  it('пролистали — диапазон только растёт', () => {
    expect(widenSeen(null, posts(25, 21))).toEqual({ first: 25, last: 21 })
    expect(widenSeen({ first: 20, last: 10 }, posts(25, 21))).toEqual({ first: 25, last: 10 })
    expect(widenSeen({ first: 20, last: 10 }, posts(8))).toEqual({ first: 20, last: 8 })
    expect(widenSeen({ first: 20, last: 10 }, [{ id: 'txid' }])).toEqual({ first: 20, last: 10 })
  })

  it('хранится по аккаунту', () => {
    saveSeen('PA', { first: 20, last: 10 })
    saveSeen('PB', { first: 5, last: 1 })
    expect(loadSeen('PA')).toEqual({ first: 20, last: 10 })
    expect(loadSeen('PB')).toEqual({ first: 5, last: 1 })
    expect(loadSeen('PC')).toBeNull()
  })
})

describe('посты подписок: только свежие', () => {
  it('старше недели — не «новое», без даты — тоже', () => {
    const now = Date.parse('2026-11-02T12:00:00Z')
    const at = (ms: number) => new Date(now - ms).toISOString()
    const list = [
      { id: 1, timestamp: at(60_000) },
      { id: 2, timestamp: at(HIGHLIGHT_MAX_AGE_MS - 60_000) },
      { id: 3, timestamp: at(HIGHLIGHT_MAX_AGE_MS + 60_000) },
      { id: 4 },
    ]
    expect(recentPosts(list, now).map((p) => p.id)).toEqual([1, 2])
  })
})
