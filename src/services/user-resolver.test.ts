import { describe, it, expect, beforeEach, vi } from 'vitest'

// Подменяем settingsAPI на in-memory мок до импорта user-resolver,
// чтобы тесты не трогали настоящий IndexedDB.
const storage = new Map<string, unknown>()
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: {
    async get(key: string) {
      return storage.get(key)
    },
    async set(key: string, value: unknown) {
      storage.set(key, value)
      return key
    },
  },
}))

// Подменяем searchUsers, чтобы проверять resolveNameRemote без сети.
const searchUsersMock =
  vi.fn<(query: string) => Promise<Array<{ address: string; name?: string }>>>()
vi.mock('@/services/search-service', () => ({
  searchUsers: (query: string) => searchUsersMock(query),
}))

import {
  ensureUserResolverLoaded,
  registerNameAddress,
  resolveNameLocal,
  resolveNameRemote,
  __resetUserResolverForTests,
} from './user-resolver'

const flush = () => new Promise((r) => setTimeout(r, 400))

describe('user-resolver', () => {
  beforeEach(() => {
    storage.clear()
    searchUsersMock.mockReset()
    __resetUserResolverForTests()
  })

  it('registers and resolves locally (case-insensitive)', () => {
    registerNameAddress([{ name: 'Alice', address: 'PADDR1' }])
    expect(resolveNameLocal('alice')).toBe('PADDR1')
    expect(resolveNameLocal('ALICE')).toBe('PADDR1')
    expect(resolveNameLocal('  Alice  ')).toBe('PADDR1')
  })

  it('skips entries without name or address', () => {
    registerNameAddress([
      { name: 'no-addr' },
      { address: 'PNOADDR' },
      { name: '', address: 'PEMPTY' },
    ])
    expect(resolveNameLocal('no-addr')).toBe(null)
  })

  it('returns null for unknown name', () => {
    expect(resolveNameLocal('unknown')).toBe(null)
  })

  it('persists to settings storage after debounce', async () => {
    registerNameAddress([{ name: 'bob', address: 'PBOB' }])
    await flush()
    const saved = storage.get('bastyonNameAddressMap') as { map: Record<string, string> }
    expect(saved.map.bob).toBe('PBOB')
  })

  it('ensureUserResolverLoaded restores cache from storage', async () => {
    storage.set('bastyonNameAddressMap', { map: { carol: 'PCAROL' } })
    await ensureUserResolverLoaded()
    expect(resolveNameLocal('carol')).toBe('PCAROL')
  })

  it('resolveNameRemote returns address on exact match and caches it', async () => {
    searchUsersMock.mockResolvedValueOnce([
      { address: 'POTHER', name: 'someoneelse' },
      { address: 'PDAVE', name: 'Dave' },
    ])
    const result = await resolveNameRemote('dave')
    expect(result).toBe('PDAVE')
    // После remote-резолва имя в локальном кеше.
    expect(resolveNameLocal('dave')).toBe('PDAVE')
  })

  it('resolveNameRemote returns null when no exact match', async () => {
    searchUsersMock.mockResolvedValueOnce([{ address: 'PEVE', name: 'eveelyn' }])
    const result = await resolveNameRemote('eve')
    expect(result).toBe(null)
  })

  it('resolveNameRemote uses local cache first', async () => {
    registerNameAddress([{ name: 'frank', address: 'PFRANK' }])
    const result = await resolveNameRemote('frank')
    expect(result).toBe('PFRANK')
    expect(searchUsersMock).not.toHaveBeenCalled()
  })

  it('overrides existing entry only when address differs', async () => {
    registerNameAddress([{ name: 'grace', address: 'PG1' }])
    registerNameAddress([{ name: 'grace', address: 'PG1' }]) // same
    registerNameAddress([{ name: 'grace', address: 'PG2' }]) // changed
    expect(resolveNameLocal('grace')).toBe('PG2')
  })
})
