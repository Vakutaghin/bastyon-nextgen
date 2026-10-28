// Коллекции из сети: обе раскладки ноды, тип коллекции, листание профиля и
// счёт правок. Образцы — ответы mainnet 28.10.2026 (сокращены).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const rawPosts = vi.hoisted(() => vi.fn())

vi.mock('@/helpers/api/request', () => ({ getByPRCWithAuth: rpc }))
vi.mock('@/composables/helpers/feed-queries', () => ({ fetchRawPostsByIds: rawPosts }))
vi.mock('@/services/user-names', () => ({ rememberUsers: vi.fn() }))

import {
  collectionKind,
  editsInWindow,
  fetchCollectionItems,
  fetchProfileCollections,
  kindOfItems,
  normalizeCollection,
  type ChainCollection,
} from './collections-api'
import type { AdaptedPost } from '@/types/adapted-post'

const A = 'f1a1bc0f4d6f3d1f460418a5a0ccb3216c8051b85e58b5019782b29c845c85c3'
const B = '07d4a53784b0ecddc34addd78f6cfc315ff1e830433f39d4a03d3220442c3018'
const ITEM1 = '4756135ad5941ce790ac8249a94df5b87113c816b7f6f6c6c22cc0966a31d5f3'
const ITEM2 = '8b2b9b39cef8dd8cd6aef152ff027080b5dae91538fc0f6c5dd5e7c3280fa3b9'
const ADDRESS = 'PDUWW57W8DoV1dMTQYsrkwg66xEuaNckbd'

const listRow = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
  txid: A,
  id: 37524654,
  edit: 'true',
  contentIds: JSON.stringify([ITEM1, ITEM2]),
  address: ADDRESS,
  l: 'ru',
  type: 'collection',
  c: 'Мои песни',
  i: 'https://peertube800.pocketnet.app/images/cover.jpg',
  s: '{"m":"https://t.me/RevKollection"}',
  height: 4069717,
  ...patch,
})

const post = (txid: string, type: string): AdaptedPost =>
  ({ id: txid, txid, hash: txid, type }) as unknown as AdaptedPost

beforeEach(() => {
  rpc.mockReset()
  rawPosts.mockReset()
})

describe('normalizeCollection', () => {
  it('раскладка списка профиля', () => {
    const c = normalizeCollection(listRow({ contentTypes: '210' }))!
    expect(c).toMatchObject({
      txid: A,
      hash: A,
      address: ADDRESS,
      contentTypes: 210,
      caption: 'Мои песни',
      description: 'https://t.me/RevKollection',
      image: 'https://peertube800.pocketnet.app/images/cover.jpg',
      contentIds: [ITEM1, ITEM2],
      edited: true,
      height: 4069717,
    })
  })

  it('раскладка одной коллекции: элементы в repost, обложка в m, настройки в t', () => {
    const c = normalizeCollection({
      hash: B,
      txid: A,
      repost: JSON.stringify([ITEM2]),
      address: ADDRESS,
      time: 1791732884,
      l: 'ru',
      type: 'collection',
      c: 'Мои песни',
      m: 'https://peertube800.pocketnet.app/images/cover.jpg',
      t: { m: 'описание', x: 1 },
      versions: [
        { h: 4056197, hs: A },
        { h: 4057958, hs: 'b'.repeat(64) },
      ],
    })!
    expect(c.hash).toBe(B)
    expect(c.contentIds).toEqual([ITEM2])
    expect(c.image).toContain('cover.jpg')
    expect(c.settings).toEqual({ m: 'описание', x: 1 })
    expect(c.contentTypes).toBeNull()
    expect(c.versions).toEqual([
      { height: 4056197, hash: A },
      { height: 4057958, hash: 'b'.repeat(64) },
    ])
  })

  it('не коллекция и битые строки — null', () => {
    expect(normalizeCollection(null)).toBeNull()
    expect(normalizeCollection(listRow({ type: 'share' }))).toBeNull()
    expect(normalizeCollection(listRow({ txid: 'x' }))).toBeNull()
  })
})

describe('тип коллекции', () => {
  it('по элементам: удалённые не считаются', () => {
    expect(kindOfItems([post(ITEM1, 'video'), null, post(ITEM2, 'video')])).toBe('video')
    expect(kindOfItems([post(ITEM1, 'audio')])).toBe('audio')
    expect(kindOfItems([post(ITEM1, 'audio'), post(ITEM2, 'video')])).toBe('posts')
    expect(kindOfItems([null])).toBe('posts')
  })

  it('тип из транзакции важнее элементов', () => {
    const c = normalizeCollection(listRow({ contentTypes: 201 }))!
    expect(collectionKind(c, [post(ITEM1, 'share')])).toBe('video')
  })
})

describe('fetchProfileCollections', () => {
  it('листает от коллекции с самым младшим номером, пока страница полная', async () => {
    const page1 = Array.from({ length: 20 }, (_, i) =>
      listRow({ txid: i.toString(16).padStart(64, 'a'), id: 100 + i })
    )
    const page2 = [listRow({ txid: 'c'.repeat(64), id: 50 })]
    rpc.mockResolvedValueOnce({ contents: page1 }).mockResolvedValueOnce({ contents: page2 })
    const all = await fetchProfileCollections(ADDRESS)
    expect(all).toHaveLength(21)
    expect(rpc.mock.calls[0]![0].parameters).toEqual([
      0,
      '',
      20,
      '',
      [],
      [],
      [],
      [],
      [],
      '',
      ADDRESS,
    ])
    expect(rpc.mock.calls[1]![0].parameters[1]).toBe('0'.padStart(64, 'a'))
  })
})

describe('fetchCollectionItems', () => {
  it('порядок по contentIds, пропавшие — null на своём месте', async () => {
    rawPosts.mockResolvedValue(
      new Map([[ITEM2, { txid: ITEM2, hash: ITEM2, type: 'video', address: ADDRESS, time: 1 }]])
    )
    const items = await fetchCollectionItems([ITEM1, ITEM2])
    expect(items[0]).toBeNull()
    expect(items[1]?.txid).toBe(ITEM2)
  })
})

describe('editsInWindow', () => {
  const base = (patch: Partial<ChainCollection>): ChainCollection => ({
    ...normalizeCollection(listRow())!,
    ...patch,
  })

  it('правки после публикации в окне 43 200 блоков и текущая версия', () => {
    const c = base({
      hash: B,
      height: 4069717,
      versions: [
        { height: 4056197, hash: A },
        { height: 4057958, hash: '1'.repeat(64) },
        { height: 4061848, hash: '2'.repeat(64) },
        { height: 4062294, hash: '3'.repeat(64) },
        { height: 4063983, hash: '4'.repeat(64) },
      ],
    })
    expect(editsInWindow(c, 4082000)).toBe(5)
    expect(editsInWindow(c, 4062294 + 43200)).toBe(2)
  })

  it('без правок — ноль', () => {
    expect(editsInWindow(base({ hash: A, versions: [] }), 4082000)).toBe(0)
  })
})
