// N11: удалённый пост в избранном не должен обрывать ленту — страница
// добирается до полного размера, остальное избранное остаётся доступным.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const favIds = vi.hoisted(() => ({ list: [] as string[] }))
const rpc = vi.hoisted(() => ({ call: vi.fn() }))

vi.mock('@/db/apis/favorites-api', () => ({
  favoritesAPI: { getAllIds: vi.fn(async () => favIds.list) },
}))
vi.mock('@/helpers/api/request', () => ({
  getByPRCWithAuth: (args: unknown) => rpc.call(args),
  getByPRC: (args: unknown) => rpc.call(args),
}))

import { buildFavoritesFeedQuery } from './feed-queries'

const ctx = (over: Record<string, unknown> = {}) =>
  ({
    currentTxid: '',
    count: 3,
    lang: 'ru',
    allTags: [],
    contentTypes: [],
    userAddress: 'PA',
    topFirst: false,
    depth: 10080,
    ...over,
  }) as Parameters<typeof buildFavoritesFeedQuery>[0]

beforeEach(() => {
  rpc.call.mockReset()
  favIds.list = []
})

/** Нода отдаёт только «живые» id — удалённые просто отсутствуют в ответе. */
function nodeWithAlive(alive: Set<string>) {
  return (args: unknown) => {
    const ids = (args as { parameters: [string[]] }).parameters[0]
    return Promise.resolve(ids.filter((id) => alive.has(id)).map((id) => ({ txid: id })))
  }
}

describe('buildFavoritesFeedQuery (N11)', () => {
  it('fills the page from the next ids when some favorites are gone', async () => {
    favIds.list = ['a', 'b', 'c', 'd', 'e', 'f']
    rpc.call.mockImplementation(nodeWithAlive(new Set(['a', 'c', 'd', 'e', 'f'])))

    const resp = await buildFavoritesFeedQuery(ctx())

    // 'b' удалён, но страница всё равно полная — лента не считает её последней.
    expect(resp.data.contents.map((p) => (p as { txid: string }).txid)).toEqual(['a', 'c', 'd'])
  })

  it('continues after the last returned post', async () => {
    favIds.list = ['a', 'b', 'c', 'd', 'e', 'f']
    rpc.call.mockImplementation(nodeWithAlive(new Set(['a', 'c', 'd', 'e', 'f'])))

    const resp = await buildFavoritesFeedQuery(ctx({ currentTxid: 'd' }))

    expect(resp.data.contents.map((p) => (p as { txid: string }).txid)).toEqual(['e', 'f'])
  })

  it('returns a short page only when the favorites really ran out', async () => {
    favIds.list = ['a', 'b']
    rpc.call.mockImplementation(nodeWithAlive(new Set(['a'])))

    const resp = await buildFavoritesFeedQuery(ctx())

    expect(resp.data.contents).toHaveLength(1)
  })
})

// Пост сохраняется в избранное под тем id, что был у карточки (адаптер берёт
// `txid || hash`), а нода может вернуть его под другим — у отредактированного
// поста txid и hash различаются. Такой пост пропадал из «Избранного».
describe('buildFavoritesFeedQuery: id сохранения ≠ id в ответе ноды', () => {
  it('находит пост, сохранённый по hash, когда нода вернула его с другим txid', async () => {
    favIds.list = ['hash-1']
    rpc.call.mockImplementation(() =>
      Promise.resolve([{ txid: 'txid-1', hash: 'hash-1', content: 'ok' }])
    )

    const res = await buildFavoritesFeedQuery(ctx({ count: 3 }))
    expect(res.data.contents).toHaveLength(1)
    expect(res.data.contents[0]).toMatchObject({ hash: 'hash-1' })
  })

  it('находит пост, сохранённый по числовому id', async () => {
    favIds.list = ['42']
    rpc.call.mockImplementation(() => Promise.resolve([{ id: 42, content: 'ok' }]))

    const res = await buildFavoritesFeedQuery(ctx({ count: 3 }))
    expect(res.data.contents).toHaveLength(1)
  })

  it('сохраняет порядок избранного, когда id разнородные', async () => {
    favIds.list = ['hash-1', 'txid-2']
    rpc.call.mockImplementation(() =>
      Promise.resolve([
        { txid: 'txid-2', hash: 'hash-2' },
        { txid: 'txid-1', hash: 'hash-1' },
      ])
    )

    const res = await buildFavoritesFeedQuery(ctx({ count: 3 }))
    expect(res.data.contents.map((p) => (p as { hash?: string }).hash)).toEqual([
      'hash-1',
      'hash-2',
    ])
  })
})
