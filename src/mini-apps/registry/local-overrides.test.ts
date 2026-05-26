import { describe, it, expect } from 'vitest'
import { LocalOverridesStore } from './local-overrides'
import { createMemoryStore } from '../storage/key-value-store'

describe('LocalOverridesStore', () => {
  it('starts empty', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    expect(await store.list()).toEqual([])
  })

  it('upsert + list', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    await store.upsert({ id: 'a.app', scope: 'a.com', addedAt: 1 })
    await store.upsert({ id: 'b.app', scope: 'b.com', addedAt: 2 })

    const list = await store.list()
    expect(list.map((x) => x.id).sort()).toEqual(['a.app', 'b.app'])
  })

  it('upsert is idempotent (same id replaces, no duplicate in index)', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    await store.upsert({ id: 'a.app', scope: 'a.com', addedAt: 1 })
    await store.upsert({ id: 'a.app', scope: 'a-new.com', addedAt: 2 })

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.scope).toBe('a-new.com')
  })

  it('remove cleans up entry and index', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    await store.upsert({ id: 'a.app', scope: 'a.com', addedAt: 1 })
    await store.remove('a.app')

    expect(await store.list()).toEqual([])
    expect(await store.get('a.app')).toBeNull()
  })

  it('get returns null for missing', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    expect(await store.get('missing')).toBeNull()
  })

  it('rejects empty id or scope', async () => {
    const store = new LocalOverridesStore(createMemoryStore())
    await expect(store.upsert({ id: '', scope: 'a.com', addedAt: 1 })).rejects.toThrow()
    await expect(store.upsert({ id: 'a.app', scope: '', addedAt: 1 })).rejects.toThrow()
  })

  it('survives corrupted index gracefully', async () => {
    const kv = createMemoryStore()
    await kv.set('local-apps-index', 'not json')
    const store = new LocalOverridesStore(kv)
    expect(await store.list()).toEqual([])
  })
})
