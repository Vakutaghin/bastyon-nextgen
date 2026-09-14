import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Заглушка для settingsAPI: тесты не должны трогать настоящий IndexedDB.
const mockStorage = new Map<string, unknown>()
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    async get(key: string) {
      return mockStorage.get(key)
    },
    async set(key: string, value: unknown) {
      mockStorage.set(key, value)
      return key
    },
  },
}))

import { useSearchStore } from './search-store'

describe('search-store', () => {
  let store: ReturnType<typeof useSearchStore>

  beforeEach(() => {
    mockStorage.clear()
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
    it('adds normalized value to history as query entry', () => {
      store.commit('blockchain')
      expect(store.history).toHaveLength(1)
      expect(store.history[0]).toMatchObject({ kind: 'query', value: 'blockchain' })
      expect(store.query).toBe('blockchain')
    })

    it('does not duplicate in history (moves to front)', () => {
      store.commit('blockchain')
      store.commit('crypto')
      store.commit('blockchain')
      const blockchainEntries = store.history.filter(
        (h) => h.kind === 'query' && h.value === 'blockchain'
      )
      expect(blockchainEntries).toHaveLength(1)
      expect(store.history[0]?.value).toBe('blockchain')
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

  describe('commitUser / commitTag / commitApp', () => {
    it('commitUser stores user entry with label and meta', () => {
      store.commitUser('PXXXXX', 'alice', 'avatar.png')
      expect(store.history[0]).toMatchObject({
        kind: 'user',
        value: 'PXXXXX',
        label: 'alice',
        meta: { avatar: 'avatar.png', name: 'alice' },
      })
    })

    it('commitTag strips leading hash and stores tag entry', () => {
      store.commitTag('##bitcoin')
      expect(store.history[0]).toMatchObject({ kind: 'tag', value: 'bitcoin', label: '#bitcoin' })
    })

    it('commitApp stores app entry', () => {
      store.commitApp('weather', 'Weather', 'icon.png')
      expect(store.history[0]).toMatchObject({ kind: 'app', value: 'weather', label: 'Weather' })
    })

    it('user and query with same string do not collide', () => {
      store.commit('alice')
      store.commitUser('alice')
      expect(store.history).toHaveLength(2)
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
    it('removes by entry object', () => {
      store.commit('keep')
      store.commit('remove')
      const target = store.history.find((h) => h.value === 'remove')!
      store.removeFromHistory(target)
      expect(store.history.map((h) => h.value)).toContain('keep')
      expect(store.history.map((h) => h.value)).not.toContain('remove')
    })

    it('removes by string (legacy / query-only)', () => {
      store.commit('keep')
      store.commit('remove')
      store.removeFromHistory('remove')
      expect(store.history.map((h) => h.value)).toContain('keep')
      expect(store.history.map((h) => h.value)).not.toContain('remove')
    })

    it('string removal does not touch entries of different kinds', () => {
      store.commitUser('alice')
      store.removeFromHistory('alice')
      expect(store.history).toHaveLength(1)
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

  describe('persistence', () => {
    it('persists commits to settings storage', async () => {
      store.commit('hello')
      // persistHistory асинхронный (определяет владельца через auth-store) — ждём запись.
      await vi.waitFor(() => expect(mockStorage.get('bastyonSearchHistory')).toBeTruthy())
      const saved = mockStorage.get('bastyonSearchHistory') as Array<{ value: string }>
      expect(saved.map((e) => e.value)).toContain('hello')
    })

    it('N25/Р5: с аккаунтом история пишется под ключ аккаунта, legacy мигрирует к нему', async () => {
      const { useAuthStore } = await import('@/blockchain/store/auth-store')
      const auth = useAuthStore()
      auth.address = 'PA' as never
      mockStorage.set('bastyonSearchHistory', [
        { kind: 'query', value: 'legacy', addedAt: 1, label: 'legacy' },
      ])
      const fresh = useSearchStore()
      await fresh.ensureLoaded()
      expect(fresh.history.map((e) => e.value)).toEqual(['legacy'])
      expect(mockStorage.get('bastyonSearchHistory')).toBeUndefined()
      fresh.commit('mine')
      await vi.waitFor(() =>
        expect(
          (mockStorage.get('bastyonSearchHistory:PA') as Array<{ value: string }>)?.map(
            (e) => e.value
          )
        ).toContain('mine')
      )
      // Смена аккаунта: память чистится, следующий аккаунт legacy не получает.
      fresh.reset()
      expect(fresh.history).toEqual([])
      auth.address = 'PB' as never
      await fresh.ensureLoaded()
      expect(fresh.history).toEqual([])
    })

    it('ensureLoaded restores history from storage', async () => {
      mockStorage.set('bastyonSearchHistory', [
        { kind: 'query', value: 'restored', addedAt: 1, label: 'restored' },
      ])
      // Свежий стор поднимет данные из mock-хранилища при первом обращении.
      setActivePinia(createPinia())
      const fresh = useSearchStore()
      await fresh.ensureLoaded()
      expect(fresh.history).toHaveLength(1)
      expect(fresh.history[0]?.value).toBe('restored')
    })

    it('ensureLoaded ignores malformed entries', async () => {
      mockStorage.set('bastyonSearchHistory', [
        { kind: 'query', value: 'ok', addedAt: 1 },
        { foo: 'bar' },
        null,
      ])
      setActivePinia(createPinia())
      const fresh = useSearchStore()
      await fresh.ensureLoaded()
      expect(fresh.history).toHaveLength(1)
    })
  })
})
