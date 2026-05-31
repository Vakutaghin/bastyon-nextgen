import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { kvStore, createMemoryStore } from './key-value-store'

vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ debug: vi.fn(), warn: vi.fn() }) },
}))

// localStorage с поддержкой length/key(i), нужных для keys().
function memLocalStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
}

const NS = 'mini-apps:'

describe('createMemoryStore', () => {
  it('get/set/remove/keys round-trip', async () => {
    const s = createMemoryStore()
    expect(await s.get('k')).toBeNull()

    await s.set('k', 'v')
    expect(await s.get('k')).toBe('v')
    expect(await s.keys()).toEqual(['k'])

    await s.remove('k')
    expect(await s.get('k')).toBeNull()
    expect(await s.keys()).toEqual([])
  })
})

describe('kvStore (в vitest деградирует на localStorage)', () => {
  let ls: ReturnType<typeof memLocalStorage>

  beforeEach(() => {
    ls = memLocalStorage()
    vi.stubGlobal('localStorage', ls)
    vi.stubGlobal('window', { localStorage: ls })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('set/get с namespace-префиксом', async () => {
    await kvStore.set('token', 'abc')
    expect(ls.getItem(NS + 'token')).toBe('abc')
    expect(await kvStore.get('token')).toBe('abc')
  })

  it('get отсутствующего ключа → null', async () => {
    expect(await kvStore.get('missing')).toBeNull()
  })

  it('remove удаляет ключ', async () => {
    await kvStore.set('k', 'v')
    await kvStore.remove('k')
    expect(await kvStore.get('k')).toBeNull()
  })

  it('keys возвращает только namespace-ключи без префикса', async () => {
    await kvStore.set('a', '1')
    await kvStore.set('b', '2')
    ls.setItem('other-module-key', 'x') // вне namespace — должен игнорироваться

    const keys = await kvStore.keys()
    expect(keys.sort()).toEqual(['a', 'b'])
  })
})
