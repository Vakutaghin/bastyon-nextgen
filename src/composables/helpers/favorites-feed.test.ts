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
