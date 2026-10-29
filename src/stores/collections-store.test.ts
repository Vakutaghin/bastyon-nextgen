// Коллекции: тип по элементам у коллекций старого клиента, своё ожидающее
// поверх ответа ноды, правка в очереди, пока прошлая не в блоке.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  fetchProfileCollections: vi.fn(),
  fetchCollection: vi.fn(),
  fetchCollectionItems: vi.fn(),
}))
const action = vi.hoisted(() => ({
  sendCollection: vi.fn(),
  deleteCollection: vi.fn(),
}))
const settled = vi.hoisted(() => ({
  listener: null as ((txid: string, ok: boolean) => void) | null,
}))

vi.mock('@/services/collections/collections-api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/collections/collections-api')>()
  return { ...real, ...api }
})
vi.mock('@/blockchain/core/actions/collection-action', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/blockchain/core/actions/collection-action')>()
  return { ...real, ...action }
})
vi.mock('@/blockchain/core/transactions/broadcast-events', () => ({
  onTransactionSettled: (fn: (txid: string, ok: boolean) => void) => {
    settled.listener = fn
    return () => undefined
  },
}))
vi.mock('@/services/media/media-info', () => ({
  fetchMediaInfo: vi.fn(
    async (urls: string[]) =>
      new Map(urls.map((u) => [u, { thumbnail: `thumb:${u}`, duration: 60, views: 1 }]))
  ),
}))

import { AUTO_COVER_KEY, draftOf, useCollectionsStore, withAutoCover } from './collections-store'
import { normalizeCollection } from '@/services/collections/collections-api'
import type { AdaptedPost } from '@/types/adapted-post'

const ADDRESS = 'PDUWW57W8DoV1dMTQYsrkwg66xEuaNckbd'
const tx = (n: number): string => n.toString(16).padStart(64, '0')

const video = (id: string): AdaptedPost =>
  ({
    id,
    txid: id,
    hash: id,
    type: 'video',
    videoUrl: `peertube://h/${id}`,
    images: [],
  }) as unknown as AdaptedPost
const share = (id: string): AdaptedPost =>
  ({
    id,
    txid: id,
    hash: id,
    type: 'share',
    images: ['https://img/1.jpg'],
  }) as unknown as AdaptedPost

const row = (txid: string, ids: string[], patch: Record<string, unknown> = {}) =>
  normalizeCollection({
    txid,
    id: 1,
    contentIds: JSON.stringify(ids),
    address: ADDRESS,
    l: 'ru',
    type: 'collection',
    c: 'Подборка',
    i: '',
    s: '',
    height: 4069717,
    ...patch,
  })!

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  Object.values(api).forEach((f) => f.mockReset())
  Object.values(action).forEach((f) => f.mockReset())
})

describe('collections-store', () => {
  it('коллекция старого клиента из одних видео — видеоплейлист, обложка — превью первого', async () => {
    api.fetchProfileCollections.mockResolvedValue([
      row(tx(1), [tx(11), tx(12)]),
      row(tx(2), [tx(21), tx(22)]),
      row(tx(3), [tx(31)], { contentTypes: '210' }),
    ])
    api.fetchCollectionItems.mockImplementation(async (ids: string[]) =>
      ids.map((id) => ([tx(11), tx(12)].includes(id) ? video(id) : share(id)))
    )
    const store = useCollectionsStore()
    await store.loadAuthor(ADDRESS)
    const list = store.collectionsOf(ADDRESS)
    expect(list.map((c) => c.kind)).toEqual(['video', 'posts', 'audio'])
    expect(list[0]!.cover).toBe(`thumb:peertube://h/${tx(11)}`)
    expect(list[1]!.cover).toBe('https://img/1.jpg')
    expect(store.ofKind(ADDRESS, 'video').map((c) => c.txid)).toEqual([tx(1)])
  })

  it('смена аккаунта после входа не стирает уже загруженный список: открытая страница его не перезапросит', async () => {
    api.fetchProfileCollections.mockResolvedValue([row(tx(1), [tx(11)], { contentTypes: '201' })])
    api.fetchCollectionItems.mockResolvedValue([])
    const store = useCollectionsStore()
    store.attach(ADDRESS)
    await store.loadAuthor(ADDRESS)
    // Так сбрасывает resetAccountScopedStores — асинхронно, уже после входа.
    store.reset()
    store.attach(ADDRESS)
    expect(store.statusOf(ADDRESS)).toBe('ready')
    expect(store.ofKind(ADDRESS, 'video').map((c) => c.txid)).toEqual([tx(1)])
  })

  it('новая коллекция видна сразу, а правка, пока она не в блоке, ждёт и уходит сама', async () => {
    api.fetchProfileCollections.mockResolvedValue([])
    api.fetchCollectionItems.mockResolvedValue([video(tx(11))])
    action.sendCollection.mockResolvedValueOnce({ txid: tx(100), payload: {} })
    const store = useCollectionsStore()
    store.attach(ADDRESS)
    const draft = {
      kind: 'video' as const,
      caption: 'Сезон 1',
      description: '',
      image: '',
      lang: 'ru',
      contentIds: [tx(11)],
    }
    const root = await store.create(draft)
    expect(root).toBe(tx(100))
    // Обложка по умолчанию — превью первого ролика, с пометкой «автоматическая».
    const sent = action.sendCollection.mock.calls[0]![0]
    expect(sent.image).toBe(`thumb:peertube://h/${tx(11)}`)
    expect(sent.settings[AUTO_COVER_KEY]).toBe(sent.image)

    const shown = store.collectionsOf(ADDRESS)
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ txid: tx(100), pending: 'create', kind: 'video' })

    const result = await store.edit(root, { ...draft, contentIds: [tx(11), tx(12)] })
    expect(result).toBe('queued')
    expect(action.sendCollection).toHaveBeenCalledTimes(1)
    expect(store.collectionsOf(ADDRESS)[0]!.contentIds).toEqual([tx(11), tx(12)])

    action.sendCollection.mockResolvedValueOnce({ txid: tx(101), payload: {} })
    await settled.listener!(tx(100), true)
    await vi.waitFor(() => expect(action.sendCollection).toHaveBeenCalledTimes(2))
    expect(action.sendCollection.mock.calls[1]![0].rootTxid).toBe(tx(100))
    expect(store.queued).toEqual([])
  })

  it('не попавшее в блок помечается, ждавшая за ним правка отменяется', async () => {
    api.fetchProfileCollections.mockResolvedValue([])
    api.fetchCollectionItems.mockResolvedValue([])
    action.sendCollection.mockResolvedValue({ txid: tx(200), payload: {} })
    const store = useCollectionsStore()
    store.attach(ADDRESS)
    const draft = {
      kind: 'posts' as const,
      caption: 'X',
      description: '',
      image: 'https://c',
      lang: 'ru',
      contentIds: [tx(1)],
    }
    await store.create(draft)
    await store.edit(tx(200), { ...draft, caption: 'Y' })
    await settled.listener!(tx(200), false)
    expect(store.queued).toEqual([])
    expect(store.collectionsOf(ADDRESS)[0]).toMatchObject({ failed: true })
    store.dismissFailed(tx(200))
    expect(store.collectionsOf(ADDRESS)).toEqual([])
  })

  it('неверная правка не встаёт в очередь', async () => {
    const store = useCollectionsStore()
    store.attach(ADDRESS)
    await expect(
      store.edit(tx(1), {
        kind: 'posts',
        caption: '',
        description: '',
        image: '',
        lang: 'ru',
        contentIds: [tx(2)],
      })
    ).rejects.toThrow()
    expect(store.queued).toEqual([])
  })

  it('своя обложка остаётся, автоматическая меняется вслед за первым элементом', async () => {
    api.fetchCollectionItems.mockResolvedValue([video(tx(5))])
    const own = await withAutoCover({
      kind: 'video',
      caption: 'a',
      description: '',
      image: 'https://my/cover.jpg',
      lang: 'ru',
      contentIds: [tx(5)],
      settings: { [AUTO_COVER_KEY]: 'old' },
    })
    expect(own.image).toBe('https://my/cover.jpg')
    expect(own.settings?.[AUTO_COVER_KEY]).toBeUndefined()

    const auto = await withAutoCover({
      kind: 'video',
      caption: 'a',
      description: '',
      image: 'old',
      lang: 'ru',
      contentIds: [tx(5)],
      settings: { [AUTO_COVER_KEY]: 'old' },
    })
    expect(auto.image).toBe(`thumb:peertube://h/${tx(5)}`)
  })

  it('черновик правки сохраняет чужие ключи настроек', () => {
    const view = {
      ...row(tx(1), [tx(2)], { s: '{"m":"о","x":1}' }),
      kind: 'posts' as const,
      cover: null,
    }
    const d = draftOf(view, [tx(3)])
    expect(d).toMatchObject({ rootTxid: tx(1), description: 'о', contentIds: [tx(3)] })
    expect(d.settings).toEqual({ m: 'о', x: 1 })
  })
})
