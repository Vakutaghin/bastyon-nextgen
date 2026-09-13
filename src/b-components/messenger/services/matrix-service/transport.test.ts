import { describe, it, expect, vi, afterEach } from 'vitest'
import { getStoreDbName, deleteSyncStores } from './transport'

afterEach(() => vi.unstubAllGlobals())

function fakeIndexedDb(existing: string[]) {
  const deleted: string[] = []
  const idb = {
    databases: async () => existing.map((name) => ({ name, version: 1 })),
    deleteDatabase: (name: string) => {
      deleted.push(name)
      const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {}
      queueMicrotask(() => req.onsuccess?.())
      return req
    },
  }
  vi.stubGlobal('window', { indexedDB: idb })
  return { deleted }
}

describe('deleteSyncStores (V15/Р6)', () => {
  it('по userId стирает ровно его БД', async () => {
    const { deleted } = fakeIndexedDb([])
    await deleteSyncStores({ userId: '@abc:pocketnet' })
    expect(deleted).toEqual([getStoreDbName('@abc:pocketnet')])
    expect(deleted[0]).toBe('bastyon-matrix-sync:_abc_pocketnet')
  })

  it('по hex адреса находит БД любого домена через indexedDB.databases(), чужие не трогает', async () => {
    const { deleted } = fakeIndexedDb([
      'bastyon-matrix-sync:_50abc_pocketnet',
      'bastyon-matrix-sync:_50abc_other.host',
      'bastyon-matrix-sync:_50abcdef_pocketnet', // другой адрес с общим префиксом hex
      'bastyon-vault',
    ])
    await deleteSyncStores({ userHex: '50ABC' })
    expect(deleted.sort()).toEqual([
      'bastyon-matrix-sync:_50abc_other.host',
      'bastyon-matrix-sync:_50abc_pocketnet',
    ])
  })

  it('без indexedDB — no-op', async () => {
    vi.stubGlobal('window', {})
    await expect(deleteSyncStores({ userId: '@x:y' })).resolves.toBeUndefined()
  })
})
