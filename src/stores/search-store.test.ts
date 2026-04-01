import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSearchStore } from './search-store'

describe('search-store', () => {
  let store: ReturnType<typeof useSearchStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSearchStore()
  })

  describe('initial state', () => {
    it('starts with empty query', () => {
      expect(store.query).toBe('')
      expect(store.hasQuery).toBe(false)
    })

    it('starts with no results', () => {
      expect(store.results).toEqual([])
      expect(store.hasResults).toBe(false)
    })

    it('starts with empty history', () => {
      expect(store.history).toEqual([])
      expect(store.recentHistory).toEqual([])
    })
  })

  describe('setQuery', () => {
    it('sets query', () => {
      store.setQuery('test')
      expect(store.query).toBe('test')
      expect(store.hasQuery).toBe(true)
    })
  })

  describe('clearQuery', () => {
    it('clears query and results', () => {
      store.setQuery('test')
      store.clearQuery()
      expect(store.query).toBe('')
      expect(store.results).toEqual([])
    })
  })

  describe('search', () => {
    it('adds to history on search', async () => {
      await store.search('blockchain')
      expect(store.history).toContain('blockchain')
    })

    it('does not duplicate in history', async () => {
      await store.search('blockchain')
      await store.search('blockchain')
      expect(store.history.filter(h => h === 'blockchain')).toHaveLength(1)
    })

    it('clears results for empty query', async () => {
      store.setQuery('')
      await store.search()
      expect(store.results).toEqual([])
    })

    it('sets loading state during search', async () => {
      const promise = store.search('test')
      // After search completes, loading should be false
      await promise
      expect(store.loading).toBe(false)
    })

    it('limits history to maxHistoryLength', async () => {
      for (let i = 0; i < 15; i++) {
        await store.search(`query${i}`)
      }
      expect(store.history.length).toBeLessThanOrEqual(store.maxHistoryLength)
    })
  })

  describe('clearHistory', () => {
    it('clears all history', async () => {
      await store.search('test1')
      await store.search('test2')
      store.clearHistory()
      expect(store.history).toEqual([])
    })
  })

  describe('removeFromHistory', () => {
    it('removes specific item from history', async () => {
      await store.search('keep')
      await store.search('remove')
      store.removeFromHistory('remove')
      expect(store.history).toContain('keep')
      expect(store.history).not.toContain('remove')
    })
  })

  describe('recentHistory', () => {
    it('returns at most maxHistoryLength items', async () => {
      for (let i = 0; i < 15; i++) {
        await store.search(`q${i}`)
      }
      expect(store.recentHistory.length).toBeLessThanOrEqual(store.maxHistoryLength)
    })
  })
})
