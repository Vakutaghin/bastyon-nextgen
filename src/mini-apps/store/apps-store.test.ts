import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from './apps-store'
import { usePermissionsStore } from './permissions-store'
import { ManifestLoader } from '../registry/manifest-loader'
import { LocalOverridesStore } from '../registry/local-overrides'
import { createMemoryStore } from '../storage/key-value-store'
import { BUILT_IN_APPS } from '../registry/built-in'

const VALID_AUTHOR = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'user.app',
    name: 'User App',
    version: '1.0.0',
    description: 'desc',
    author: VALID_AUTHOR,
    permissions: ['account'],
    ...overrides,
  })
}

function mockFetch(handler: (url: string) => { ok: boolean; status?: number; text: string }) {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const r = handler(url)
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      text: async () => r.text,
    } as unknown as Response
  })
}

function setupStore(fetchHandler?: Parameters<typeof mockFetch>[0]) {
  setActivePinia(createPinia())
  const store = useAppsStore()
  const fetchImpl = mockFetch(fetchHandler ?? (() => ({ ok: true, text: manifestJson() })))
  const loader = new ManifestLoader({ fetchImpl })
  const overrides = new LocalOverridesStore(createMemoryStore())
  store.configure({ loader, overrides })

  // apps-store.init() вызывает permissions-store.init() — изолируем его на in-memory KV.
  const perms = usePermissionsStore()
  perms.configure({ kv: createMemoryStore() })

  return { store, fetchImpl, loader, overrides, perms }
}

describe('useAppsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('init', () => {
    it('installs all built-ins synchronously (no fetch)', async () => {
      const { store, fetchImpl } = setupStore()
      await store.init()

      expect(store.ready).toBe(true)
      for (const builtIn of BUILT_IN_APPS) {
        expect(store.byId(builtIn.id)).toBeDefined()
        expect(store.byId(builtIn.id)?.source).toBe('built-in')
        expect(store.byId(builtIn.id)?.cantdelete).toBe(true)
      }
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('is idempotent', async () => {
      const { store } = setupStore()
      await store.init()
      const countAfter1 = store.installedCount
      await store.init()
      expect(store.installedCount).toBe(countAfter1)
    })

    it('reloads previously-added local overrides', async () => {
      const { store, overrides } = setupStore()
      await overrides.upsert({ id: 'user.app', scope: 'user.com', addedAt: 1 })

      await store.init()
      expect(store.byId('user.app')?.source).toBe('local')
    })

    it('survives broken local override (does not block built-ins)', async () => {
      const { store, overrides } = setupStore(() => ({ ok: false, status: 500, text: '' }))
      await overrides.upsert({ id: 'broken.app', scope: 'broken.com', addedAt: 1 })

      await store.init()
      expect(store.ready).toBe(true)
      expect(store.byId('broken.app')).toBeUndefined()
      // Built-ins всё равно установлены
      expect(store.byId('barteron.pocketnet.app')).toBeDefined()
    })
  })

  describe('install', () => {
    it('installs a valid user app', async () => {
      const { store } = setupStore()
      await store.install('user.com', { source: 'local' })

      const app = store.byId('user.app')
      expect(app).toBeDefined()
      expect(app?.scope).toBe('user.com')
      expect(app?.source).toBe('local')
      expect(app?.manifest.name).toBe('User App')
    })

    it('rejects invalid manifest', async () => {
      const { store } = setupStore(() => ({ ok: true, text: '{invalid' }))
      await expect(store.install('user.com', { source: 'local' })).rejects.toThrow()
      expect(store.byId('user.app')).toBeUndefined()
    })

    it('returns same app on duplicate install (by known id) — no double fetch', async () => {
      const { store, fetchImpl } = setupStore()
      const a = await store.install('user.com', { id: 'user.app', source: 'local' })
      const b = await store.install('user.com', { id: 'user.app', source: 'local' })
      // Ссылочное равенство не гарантировано (Pinia оборачивает state в reactive proxy),
      // но контент должен совпасть.
      expect(a.manifest.id).toBe(b.manifest.id)
      expect(fetchImpl).toHaveBeenCalledOnce()
    })

    it('discrepancy:id error when manifest id != expected', async () => {
      const { store } = setupStore(() => ({
        ok: true,
        text: manifestJson({ id: 'other.app' }),
      }))
      await expect(store.install('user.com', { id: 'user.app', source: 'local' })).rejects.toThrow(
        /discrepancy:id/
      )
    })

    it('writes error to state on failure', async () => {
      const { store } = setupStore(() => ({ ok: false, status: 404, text: '' }))
      await expect(store.install('user.com', { id: 'user.app', source: 'local' })).rejects.toThrow()
      expect(store.errors['user.app']).toBeTruthy()
    })
  })

  describe('addLocal', () => {
    it('installs and persists override', async () => {
      const { store, overrides } = setupStore()
      await store.addLocal('user.com')

      expect(store.byId('user.app')?.source).toBe('local')
      const persisted = await overrides.get('user.app')
      expect(persisted?.scope).toBe('user.com')
    })
  })

  describe('uninstall', () => {
    it('removes a local app', async () => {
      const { store, overrides } = setupStore()
      await store.addLocal('user.com')
      await store.uninstall('user.app')

      expect(store.byId('user.app')).toBeUndefined()
      expect(await overrides.get('user.app')).toBeNull()
    })

    it('refuses to uninstall a built-in', async () => {
      const { store } = setupStore()
      await store.init()
      await expect(store.uninstall('barteron.pocketnet.app')).rejects.toThrow(/cannot delete/)
      expect(store.byId('barteron.pocketnet.app')).toBeDefined()
    })

    it('no-op when app not installed', async () => {
      const { store } = setupStore()
      await expect(store.uninstall('ghost.app')).resolves.toBeUndefined()
    })
  })

  describe('originResolver', () => {
    it('resolves built-in by origin', async () => {
      const { store } = setupStore()
      await store.init()

      const app = store.originResolver.resolveByOrigin('https://barteron.club')
      expect(app?.manifest.id).toBe('barteron.pocketnet.app')
    })

    it('resolves local app by origin', async () => {
      const { store } = setupStore()
      await store.install('user.com', { source: 'local' })

      const app = store.originResolver.resolveByOrigin('https://user.com')
      expect(app?.manifest.id).toBe('user.app')
    })

    it('returns null for unknown origin', async () => {
      const { store } = setupStore()
      await store.init()
      expect(store.originResolver.resolveByOrigin('https://evil.com')).toBeNull()
    })
  })

  describe('getters', () => {
    it('forGrid filters and sorts', async () => {
      const { store } = setupStore()
      await store.init()

      const grid = store.forGrid
      // Все built-ins имеют includeInMiniApps по умолчанию true
      expect(grid.length).toBe(BUILT_IN_APPS.length)
      // Сортировка по имени
      const names = grid.map((a) => a.manifest.name)
      expect([...names].sort()).toEqual(names)
    })

    it('installedCount reflects state', async () => {
      const { store } = setupStore()
      expect(store.installedCount).toBe(0)
      await store.init()
      expect(store.installedCount).toBe(BUILT_IN_APPS.length)
    })
  })

  describe('installFromRemoteEntry', () => {
    it('synthesizes InstalledApp from remote entry without network', async () => {
      const { store, fetchImpl } = setupStore()
      const app = store.installFromRemoteEntry({
        id: 'remote.app',
        name: 'Remote App',
        scope: 'remote.example.com',
        icon: 'https://remote.example.com/icon.png',
      })

      expect(app.manifest.id).toBe('remote.app')
      expect(app.manifest.name).toBe('Remote App')
      expect(app.scope).toBe('remote.example.com')
      expect(app.icon).toBe('https://remote.example.com/icon.png')
      expect(app.source).toBe('remote-session')
      expect(store.byId('remote.app')).toBeDefined()
      // Нет fetch'а манифеста
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('remote-session entries are NOT shown in forGrid', () => {
      const { store } = setupStore()
      store.installFromRemoteEntry({
        id: 'session.app',
        name: 'Session',
        scope: 'session.com',
      })
      const ids = store.forGrid.map((a) => a.manifest.id)
      expect(ids).not.toContain('session.app')
    })

    it('but they ARE resolvable by origin (for bridge)', () => {
      const { store } = setupStore()
      store.installFromRemoteEntry({ id: 'session.app', name: 'S', scope: 'session.com' })
      expect(store.originResolver.resolveByOrigin('https://session.com')?.manifest.id).toBe(
        'session.app'
      )
    })

    it('pinSession promotes remote-session to local + persists', async () => {
      const { store, overrides } = setupStore()
      store.installFromRemoteEntry({
        id: 'pin.app',
        name: 'Pin',
        scope: 'pin.example.com',
      })

      await store.pinSession('pin.app')

      expect(store.byId('pin.app')?.source).toBe('local')
      expect(await overrides.get('pin.app')).toMatchObject({ scope: 'pin.example.com' })
      // После закрепления — появилось в forGrid
      expect(store.forGrid.map((a) => a.manifest.id)).toContain('pin.app')
    })

    it('pinSession is no-op for non-session apps', async () => {
      const { store } = setupStore()
      await store.init()
      await store.pinSession('barteron.pocketnet.app') // built-in
      expect(store.byId('barteron.pocketnet.app')?.source).toBe('built-in')
    })

    it('returns existing app when id already installed', async () => {
      const { store } = setupStore()
      await store.init()
      const builtIn = store.byId('barteron.pocketnet.app')!

      const result = store.installFromRemoteEntry({
        id: 'barteron.pocketnet.app',
        name: 'Some Remote Name',
        scope: 'fake.scope.com',
      })

      // Возвращает существующий built-in, не перезаписывает
      expect(result.scope).toBe(builtIn.scope)
      expect(result.source).toBe('built-in')
    })

    it('falls back to scope-based icon when entry.icon missing', () => {
      const { store } = setupStore()
      const app = store.installFromRemoteEntry({
        id: 'no-icon.app',
        name: 'No Icon',
        scope: 'noicon.example.com',
      })
      expect(app.icon).toBe('https://noicon.example.com/b_icon.png')
    })

    it('registered remote app participates in originResolver', () => {
      const { store } = setupStore()
      store.installFromRemoteEntry({
        id: 'r.app',
        name: 'R',
        scope: 'r.example.com',
      })

      expect(store.originResolver.resolveByOrigin('https://r.example.com')?.manifest.id).toBe(
        'r.app'
      )
    })
  })

  describe('reload', () => {
    it('re-fetches manifest after invalidation', async () => {
      const { store, fetchImpl } = setupStore()
      await store.install('user.com', { id: 'user.app', source: 'local' })
      expect(fetchImpl).toHaveBeenCalledTimes(1)

      await store.reload('user.app')
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('throws when reloading non-existent app', async () => {
      const { store } = setupStore()
      await expect(store.reload('ghost.app')).rejects.toThrow(/not installed/)
    })
  })
})
