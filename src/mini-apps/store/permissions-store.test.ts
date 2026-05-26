import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePermissionsStore } from './permissions-store'
import { createMemoryStore, type KeyValueStore } from '../storage/key-value-store'

function setupStore(kv: KeyValueStore = createMemoryStore()) {
  setActivePinia(createPinia())
  const store = usePermissionsStore()
  store.configure({ kv })
  return { store, kv }
}

describe('usePermissionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('set/get', () => {
    it('persists granted state', async () => {
      const { store } = setupStore()
      await store.set('app1', 'account', 'granted', 'user')

      expect(store.stateOf('app1', 'account')).toBe('granted')
      expect(store.isGranted('app1', 'account')).toBe(true)
    })

    it('persists denied state', async () => {
      const { store } = setupStore()
      await store.set('app1', 'account', 'denied', 'user')

      expect(store.stateOf('app1', 'account')).toBe('denied')
      expect(store.isGranted('app1', 'account')).toBe(false)
    })

    it('survives reload — denied state recovered from KV', async () => {
      const kv = createMemoryStore()
      const { store: store1 } = setupStore(kv)
      await store1.set('app1', 'account', 'denied', 'user')

      const { store: store2 } = setupStore(kv)
      await store2.init()
      expect(store2.stateOf('app1', 'account')).toBe('denied')
    })

    it('session grants are NOT persisted', async () => {
      const kv = createMemoryStore()
      const { store: store1 } = setupStore(kv)
      await store1.set('app1', 'geolocation', 'session', 'user')

      // In memory — есть
      expect(store1.isGranted('app1', 'geolocation')).toBe(true)

      // Перегружаем — не должно остаться
      const { store: store2 } = setupStore(kv)
      await store2.init()
      expect(store2.stateOf('app1', 'geolocation')).toBeNull()
    })

    it('uniq permissions never persist — even if granted via set()', async () => {
      const kv = createMemoryStore()
      const { store: store1 } = setupStore(kv)
      await store1.set('app1', 'sign', 'granted', 'user')

      // В памяти ничего нет — uniq не пишет в state
      expect(store1.stateOf('app1', 'sign')).toBeNull()

      // И тем более не в KV
      const { store: store2 } = setupStore(kv)
      await store2.init()
      expect(store2.stateOf('app1', 'sign')).toBeNull()
    })

    it('returns null for unset permission', async () => {
      const { store } = setupStore()
      expect(store.stateOf('app1', 'account')).toBeNull()
    })
  })

  describe('revoke', () => {
    it('removes a single permission', async () => {
      const { store } = setupStore()
      await store.set('app1', 'account', 'granted', 'user')
      await store.set('app1', 'chat', 'granted', 'user')
      await store.revoke('app1', 'account')

      expect(store.stateOf('app1', 'account')).toBeNull()
      expect(store.stateOf('app1', 'chat')).toBe('granted')
    })

    it('revoked permission persists as absent across reload', async () => {
      const kv = createMemoryStore()
      const { store: store1 } = setupStore(kv)
      await store1.set('app1', 'account', 'granted', 'user')
      await store1.revoke('app1', 'account')

      const { store: store2 } = setupStore(kv)
      await store2.init()
      expect(store2.stateOf('app1', 'account')).toBeNull()
    })

    it('cleans up index when last permission revoked', async () => {
      const kv = createMemoryStore()
      const { store } = setupStore(kv)
      await store.set('app1', 'account', 'granted', 'user')
      await store.revoke('app1', 'account')

      // Index должен быть пуст или не содержать app1
      const indexRaw = await kv.get('perms-index')
      const ids: string[] = indexRaw ? JSON.parse(indexRaw) : []
      expect(ids).not.toContain('app1')
    })

    it('no-op for non-existent', async () => {
      const { store } = setupStore()
      await expect(store.revoke('app1', 'account')).resolves.toBeUndefined()
    })
  })

  describe('revokeAll', () => {
    it('removes all permissions for an app', async () => {
      const { store } = setupStore()
      await store.set('app1', 'account', 'granted', 'user')
      await store.set('app1', 'chat', 'granted', 'user')
      await store.set('app2', 'account', 'granted', 'user')

      await store.revokeAll('app1')

      expect(store.forApp('app1')).toEqual([])
      expect(store.forApp('app2')).toHaveLength(1)
    })

    it('persists revocation', async () => {
      const kv = createMemoryStore()
      const { store: store1 } = setupStore(kv)
      await store1.set('app1', 'account', 'granted', 'user')
      await store1.revokeAll('app1')

      const { store: store2 } = setupStore(kv)
      await store2.init()
      expect(store2.forApp('app1')).toEqual([])
    })
  })

  describe('clearSessionGrants', () => {
    it('removes only session grants', async () => {
      const { store } = setupStore()
      await store.set('app1', 'geolocation', 'session', 'user')
      await store.set('app1', 'account', 'granted', 'user')

      store.clearSessionGrants('app1')

      expect(store.stateOf('app1', 'geolocation')).toBeNull()
      expect(store.stateOf('app1', 'account')).toBe('granted')
    })
  })

  describe('forApp getter', () => {
    it('returns list of grants', async () => {
      const { store } = setupStore()
      await store.set('app1', 'account', 'granted', 'user')
      await store.set('app1', 'chat', 'denied', 'user')

      const list = store.forApp('app1')
      expect(list).toHaveLength(2)
      expect(list.map((g) => g.permission).sort()).toEqual(['account', 'chat'])
    })

    it('returns empty array for unknown app', () => {
      const { store } = setupStore()
      expect(store.forApp('ghost')).toEqual([])
    })
  })

  describe('init', () => {
    it('is idempotent', async () => {
      const { store } = setupStore()
      await store.init()
      const ready1 = store.ready
      await store.init()
      expect(store.ready).toBe(ready1)
    })

    it('survives corrupted KV entry', async () => {
      const kv = createMemoryStore()
      await kv.set('perms-index', '["app1"]')
      await kv.set('perms:app1', 'not json')

      const { store } = setupStore(kv)
      await expect(store.init()).resolves.toBeUndefined()
      expect(store.ready).toBe(true)
      expect(store.forApp('app1')).toEqual([])
    })

    it('filters unknown permissions on load', async () => {
      const kv = createMemoryStore()
      await kv.set('perms-index', '["app1"]')
      await kv.set(
        'perms:app1',
        JSON.stringify([
          { permission: 'account', state: 'granted', source: 'user', grantedAt: 1 },
          { permission: 'fakeperm', state: 'granted', source: 'user', grantedAt: 1 },
        ])
      )

      const { store } = setupStore(kv)
      await store.init()
      expect(store.forApp('app1')).toHaveLength(1)
      expect(store.stateOf('app1', 'account')).toBe('granted')
    })
  })

  describe('unknown permission', () => {
    it('throws when setting unknown permission', async () => {
      const { store } = setupStore()
      // @ts-expect-error — намеренно невалидное имя
      await expect(store.set('app1', 'fakeperm', 'granted', 'user')).rejects.toThrow()
    })
  })
})
