import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoriteMiniAppsStore } from './favorites-store'
import { createMemoryStore, type KeyValueStore } from '../storage/key-value-store'

function setup(kv: KeyValueStore = createMemoryStore()) {
  setActivePinia(createPinia())
  const store = useFavoriteMiniAppsStore()
  store.configure({ kv })
  return { store, kv }
}

const SAMPLE = {
  id: 'tetris.amurkupon.app',
  name: 'Тетрис',
  scope: 'tetris.amurkupon.ru',
  icon: 'https://tetris.amurkupon.ru/b_icon.png',
}

describe('useFavoriteMiniAppsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const { store } = setup()
    expect(store.items).toEqual([])
    expect(store.count).toBe(0)
  })

  it('add / remove / toggle', async () => {
    const { store } = setup()
    await store.add(SAMPLE)
    expect(store.isFavorite(SAMPLE.id)).toBe(true)
    expect(store.count).toBe(1)

    await store.remove(SAMPLE.id)
    expect(store.isFavorite(SAMPLE.id)).toBe(false)

    await store.toggle(SAMPLE)
    expect(store.isFavorite(SAMPLE.id)).toBe(true)
    await store.toggle(SAMPLE)
    expect(store.isFavorite(SAMPLE.id)).toBe(false)
  })

  it('add is idempotent — no duplicates', async () => {
    const { store } = setup()
    await store.add(SAMPLE)
    await store.add(SAMPLE)
    expect(store.count).toBe(1)
  })

  it('persists across reload', async () => {
    const kv = createMemoryStore()
    const { store: a } = setup(kv)
    await a.add(SAMPLE)

    const { store: b } = setup(kv)
    await b.init()
    expect(b.isFavorite(SAMPLE.id)).toBe(true)
    expect(b.items[0]?.name).toBe('Тетрис')
  })

  it('init is idempotent', async () => {
    const { store } = setup()
    await store.init()
    const ready1 = store.ready
    await store.init()
    expect(store.ready).toBe(ready1)
  })

  it('survives corrupted KV entry', async () => {
    const kv = createMemoryStore()
    await kv.set('favorites', 'not json')

    const { store } = setup(kv)
    await expect(store.init()).resolves.toBeUndefined()
    expect(store.items).toEqual([])
  })

  it('filters out entries with missing required fields on load', async () => {
    const kv = createMemoryStore()
    await kv.set(
      'favorites',
      JSON.stringify([
        SAMPLE,
        { id: 'bad', name: 'no scope' }, // missing scope
        { id: 'bad2', scope: 'x.com', icon: 'i' }, // missing name
        'not an object',
      ])
    )

    const { store } = setup(kv)
    await store.init()
    expect(store.items).toHaveLength(1)
    expect(store.items[0]?.id).toBe(SAMPLE.id)
  })

  it('records addedAt timestamp', async () => {
    const { store } = setup()
    const before = Date.now()
    await store.add(SAMPLE)
    const after = Date.now()
    const fav = store.items[0]!
    expect(fav.addedAt).toBeGreaterThanOrEqual(before)
    expect(fav.addedAt).toBeLessThanOrEqual(after)
  })

  it('remove of non-existent is no-op', async () => {
    const { store } = setup()
    await expect(store.remove('ghost')).resolves.toBeUndefined()
  })
})
