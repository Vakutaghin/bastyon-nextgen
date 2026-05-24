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

    it('hasQuery is false for whitespace-only input', () => {
      store.setQuery('   ')
      expect(store.hasQuery).toBe(false)
    })
  })

  describe('clearQuery', () => {
    it('clears query', () => {
      store.setQuery('test')
      store.clearQuery()
      expect(store.query).toBe('')
    })
  })

  describe('commit', () => {
    it('adds normalized value to history', () => {
      store.commit('blockchain')
      expect(store.history).toContain('blockchain')
      expect(store.query).toBe('blockchain')
    })

    it('does not duplicate in history (moves to front)', () => {
      store.commit('blockchain')
      store.commit('crypto')
      store.commit('blockchain')
      expect(store.history.filter((h) => h === 'blockchain')).toHaveLength(1)
      expect(store.history[0]).toBe('blockchain')
    })

    it('ignores empty / whitespace input', () => {
      store.commit('   ')
      expect(store.history).toEqual([])
    })

    it('returns the sanitized value', () => {
      const value = store.commit('hello!!!')
      expect(value).toBe('hello')
    })

    it('limits history to maxHistoryLength', () => {
      for (let i = 0; i < 15; i++) {
        store.commit(`query${i}`)
      }
      expect(store.history.length).toBeLessThanOrEqual(store.maxHistoryLength)
    })
  })

  describe('clearHistory', () => {
    it('clears all history', () => {
      store.commit('test1')
      store.commit('test2')
      store.clearHistory()
      expect(store.history).toEqual([])
    })
  })

  describe('removeFromHistory', () => {
    it('removes specific item from history', () => {
      store.commit('keep')
      store.commit('remove')
      store.removeFromHistory('remove')
      expect(store.history).toContain('keep')
      expect(store.history).not.toContain('remove')
    })
  })

  describe('recentHistory', () => {
    it('returns at most maxHistoryLength items', () => {
      for (let i = 0; i < 15; i++) {
        store.commit(`q${i}`)
      }
      expect(store.recentHistory.length).toBeLessThanOrEqual(store.maxHistoryLength)
    })
  })
})
