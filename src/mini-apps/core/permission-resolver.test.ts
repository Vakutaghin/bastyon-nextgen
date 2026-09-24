import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { PermissionResolver } from './permission-resolver'
import { usePermissionsStore } from '../store/permissions-store'
import { createMemoryStore } from '../storage/key-value-store'
import type { InstalledApp } from '../types/app'
import type { ParsedManifest } from '../types/manifest'

const APP: InstalledApp = {
  manifest: { id: 'demo.app', name: 'Demo' } as ParsedManifest,
  scope: 'demo.app.com',
  icon: '',
  source: 'built-in',
  installedAt: 0,
}

function setup() {
  setActivePinia(createPinia())
  const store = usePermissionsStore()
  store.configure({ kv: createMemoryStore() })
  return { store }
}

describe('PermissionResolver.request', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ─── policy: auto (без prompt) ────────────────────────────────────────────

  it('grants auto-permission without prompt', async () => {
    setup()
    const promptUser = vi.fn()
    const resolver = new PermissionResolver({ promptUser })

    // `messaging` имеет meta.auto: true
    const result = await resolver.request(APP, 'messaging')
    expect(result).toBe('granted')
    expect(promptUser).not.toHaveBeenCalled()
  })

  it('saves auto-grant with source="auto"', async () => {
    const { store } = setup()
    const resolver = new PermissionResolver({ promptUser: vi.fn() })

    await resolver.request(APP, 'messaging')
    const list = store.forApp('demo.app')
    expect(list[0]?.source).toBe('auto')
  })

  // ─── policy: ensure ───────────────────────────────────────────────────────

  it('uses ensureRunner — true skips prompt', async () => {
    setup()
    const promptUser = vi.fn()
    const ensureRunner = vi.fn().mockResolvedValue(true)
    const resolver = new PermissionResolver({ promptUser, ensureRunner })

    // `notifications` имеет meta.ensure в legacy, но в нашей мета-таблице это просто
    // permission без `auto`. ensureRunner — внешний хук.
    const result = await resolver.request(APP, 'notifications')
    expect(result).toBe('granted')
    expect(ensureRunner).toHaveBeenCalledWith('notifications', APP)
    expect(promptUser).not.toHaveBeenCalled()
  })

  it('falls back to prompt when ensureRunner returns false', async () => {
    setup()
    const promptUser = vi.fn().mockResolvedValue('granted')
    const ensureRunner = vi.fn().mockResolvedValue(false)
    const resolver = new PermissionResolver({ promptUser, ensureRunner })

    const result = await resolver.request(APP, 'notifications')
    expect(result).toBe('granted')
    expect(promptUser).toHaveBeenCalledOnce()
  })

  it('falls back to prompt when ensureRunner throws', async () => {
    setup()
    const promptUser = vi.fn().mockResolvedValue('denied')
    const ensureRunner = vi.fn().mockRejectedValue(new Error('boom'))
    const resolver = new PermissionResolver({ promptUser, ensureRunner })

    const result = await resolver.request(APP, 'notifications')
    expect(result).toBe('denied')
    expect(promptUser).toHaveBeenCalledOnce()
  })

  // ─── policy: prompt + persistence ─────────────────────────────────────────

  it('prompts user for normal permission and persists granted', async () => {
    const { store } = setup()
    const promptUser = vi.fn().mockResolvedValue('granted')
    const resolver = new PermissionResolver({ promptUser })

    const result = await resolver.request(APP, 'account')
    expect(result).toBe('granted')
    expect(promptUser).toHaveBeenCalledOnce()
    expect(store.stateOf('demo.app', 'account')).toBe('granted')
  })

  it('persists denied state — no prompt on next call', async () => {
    const { store } = setup()
    const promptUser = vi.fn().mockResolvedValue('denied')
    const resolver = new PermissionResolver({ promptUser })

    await resolver.request(APP, 'account')
    expect(store.stateOf('demo.app', 'account')).toBe('denied')

    promptUser.mockClear()
    const second = await resolver.request(APP, 'account')
    expect(second).toBe('denied')
    expect(promptUser).not.toHaveBeenCalled()
  })

  // ─── policy: uniq (every time) ────────────────────────────────────────────

  it('uniq permission prompts every time, never persists', async () => {
    const { store } = setup()
    const promptUser = vi.fn().mockResolvedValue('granted')
    const resolver = new PermissionResolver({ promptUser })

    // `sign` имеет meta.uniq: true
    await resolver.request(APP, 'sign')
    await resolver.request(APP, 'sign')
    await resolver.request(APP, 'sign')

    expect(promptUser).toHaveBeenCalledTimes(3)
    expect(store.stateOf('demo.app', 'sign')).toBeNull()
  })

  // ─── P2-12: throttle + abort ──────────────────────────────────────────────

  it('P2-12: троттлит одновременные prompt одного приложения (лишний → ephemeral denied)', async () => {
    const { store } = setup()
    let releaseFirst!: (r: 'granted' | 'denied') => void
    const promptUser = vi.fn(() => new Promise<'granted' | 'denied'>((res) => (releaseFirst = res)))
    const resolver = new PermissionResolver({ promptUser })

    const p1 = resolver.request(APP, 'sign') // занимает слот, prompt висит
    const denied = await resolver.request(APP, 'sign') // одновременный → троттл
    expect(denied).toBe('denied')
    expect(promptUser).toHaveBeenCalledTimes(1) // второй модал не открылся

    releaseFirst('granted')
    expect(await p1).toBe('granted')
    expect(store.stateOf('demo.app', 'sign')).toBeNull() // ephemeral, не персистится
  })

  it('P2-12: отменяет ожидающий prompt по abort-сигналу iframe', async () => {
    setup()
    const promptUser = vi.fn(() => new Promise<'granted' | 'denied'>(() => {})) // не резолвится
    const resolver = new PermissionResolver({ promptUser })
    const ctrl = new AbortController()

    const p = resolver.request(APP, 'sign', undefined, ctrl.signal)
    ctrl.abort()
    expect(await p).toBe('denied')
  })

  // ─── policy: session ──────────────────────────────────────────────────────

  it('geolocation grant is session-state (in-memory only)', async () => {
    const { store } = setup()
    const promptUser = vi.fn().mockResolvedValue('granted')
    const resolver = new PermissionResolver({ promptUser })

    await resolver.request(APP, 'geolocation')
    expect(store.stateOf('demo.app', 'geolocation')).toBe('session')
    expect(store.isGranted('demo.app', 'geolocation')).toBe(true)
  })

  it('session grant disappears after clearSessionGrants', async () => {
    const { store } = setup()
    const resolver = new PermissionResolver({
      promptUser: vi.fn().mockResolvedValue('granted'),
    })

    await resolver.request(APP, 'geolocation')
    store.clearSessionGrants('demo.app')
    expect(store.stateOf('demo.app', 'geolocation')).toBeNull()
  })

  // ─── full lifecycle (acceptance) ──────────────────────────────────────────

  it('full cycle: prompt → grant → revoke → prompt again', async () => {
    const { store } = setup()
    const promptUser = vi.fn().mockResolvedValue('granted')
    const resolver = new PermissionResolver({ promptUser })

    // 1. Первый запрос → prompt → granted
    expect(await resolver.request(APP, 'account')).toBe('granted')
    expect(promptUser).toHaveBeenCalledTimes(1)

    // 2. Второй запрос → cached → no prompt
    expect(await resolver.request(APP, 'account')).toBe('granted')
    expect(promptUser).toHaveBeenCalledTimes(1)

    // 3. Revoke
    await store.revoke('demo.app', 'account')

    // 4. Третий запрос → prompt снова
    expect(await resolver.request(APP, 'account')).toBe('granted')
    expect(promptUser).toHaveBeenCalledTimes(2)
  })

  // ─── check() ──────────────────────────────────────────────────────────────

  it('check() returns true for granted', async () => {
    const { store } = setup()
    await store.set('demo.app', 'account', 'granted', 'user')
    const resolver = new PermissionResolver({ promptUser: vi.fn() })

    expect(resolver.check(APP, 'account')).toBe(true)
  })

  it('check() returns false for denied', async () => {
    const { store } = setup()
    await store.set('demo.app', 'account', 'denied', 'user')
    const resolver = new PermissionResolver({ promptUser: vi.fn() })

    expect(resolver.check(APP, 'account')).toBe(false)
  })

  it('check() returns false for not-set', () => {
    setup()
    const resolver = new PermissionResolver({ promptUser: vi.fn() })
    expect(resolver.check(APP, 'account')).toBe(false)
  })
})

// ─── V23: отмена ожидания ≠ ответ пользователя ──────────────────────────────

describe('PermissionResolver — prompt, оборванный таймаутом RPC (V23)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('не персистит denied, если ждать перестали до ответа пользователя', async () => {
    const { store } = setup()
    const ctrl = new AbortController()
    // Пользователь читает промпт — ответа нет, пока не оборвём ожидание.
    const promptUser = vi.fn(() => new Promise<'granted' | 'denied'>(() => {}))
    const resolver = new PermissionResolver({ promptUser })

    const pending = resolver.request(APP, 'account', undefined, ctrl.signal)
    ctrl.abort(new Error('rpc_timeout'))

    expect(await pending).toBe('denied')
    expect(store.stateOf('demo.app', 'account')).toBeNull()

    // Следующий вызов снова спрашивает, а не отбивается сохранённым отказом.
    const resolver2 = new PermissionResolver({ promptUser: vi.fn().mockResolvedValue('granted') })
    expect(await resolver2.request(APP, 'account')).toBe('granted')
  })

  it('отдаёт promptUser signal, чтобы UI закрыл модалку', async () => {
    setup()
    const ctrl = new AbortController()
    let seen: AbortSignal | undefined
    const promptUser = vi.fn((ctx: { signal?: AbortSignal }) => {
      seen = ctx.signal
      return new Promise<'granted' | 'denied'>(() => {})
    })
    const resolver = new PermissionResolver({ promptUser })

    const pending = resolver.request(APP, 'account', undefined, ctrl.signal)
    expect(seen).toBe(ctrl.signal)
    ctrl.abort()
    await pending
  })

  it('обычный отказ пользователя по-прежнему сохраняется', async () => {
    const { store } = setup()
    const resolver = new PermissionResolver({
      promptUser: vi.fn().mockResolvedValue('denied'),
    })

    expect(await resolver.request(APP, 'account', undefined, new AbortController().signal)).toBe(
      'denied'
    )
    expect(store.stateOf('demo.app', 'account')).toBe('denied')
  })
})

// ─── V24: грант привязан к origin ───────────────────────────────────────────

describe('PermissionResolver — гранты не наследуются чужим origin (V24)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const SIDELOADED: InstalledApp = {
    manifest: { id: 'somegame.app', name: 'Game' } as ParsedManifest,
    scope: 'evil.example',
    icon: '',
    source: 'local',
    installedAt: 0,
  }

  const CATALOG: InstalledApp = { ...SIDELOADED, scope: 'somegame.app' }

  it('приложение с тем же id, но другим origin, спрашивает заново', async () => {
    const { store } = setup()
    const resolver = new PermissionResolver({ promptUser: vi.fn().mockResolvedValue('granted') })

    await resolver.request(CATALOG, 'account')
    expect(store.forApp('somegame.app')[0]?.origin).toBe('https://somegame.app')

    const promptUser = vi.fn().mockResolvedValue('denied')
    const resolver2 = new PermissionResolver({ promptUser })
    expect(await resolver2.request(SIDELOADED, 'account')).toBe('denied')
    expect(promptUser).toHaveBeenCalledTimes(1)
  })

  it('check() не видит грант чужого origin', async () => {
    const { store } = setup()
    await store.set('somegame.app', 'account', 'granted', 'user', 'https://somegame.app')
    const resolver = new PermissionResolver({ promptUser: vi.fn() })

    expect(resolver.check(CATALOG, 'account')).toBe(true)
    expect(resolver.check(SIDELOADED, 'account')).toBe(false)
  })

  it('тот же origin через tscope считается своим', async () => {
    const { store } = setup()
    await store.set('somegame.app', 'account', 'granted', 'user', 'https://test.somegame.app')
    const resolver = new PermissionResolver({ promptUser: vi.fn() })

    expect(resolver.check({ ...CATALOG, tscope: 'test.somegame.app' }, 'account')).toBe(true)
  })
})
