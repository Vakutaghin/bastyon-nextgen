// Какой RPC и с какими параметрами уходит на ноду для каждой вкладки ленты:
// подписки, обсуждаемое, «Сначала лучшее», лента по дате; фиксированная высота
// для следующих страниц и разбор ответа getrawtransactionwithmessagebyid.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.hoisted(() => ({ call: vi.fn() }))
const favIds = vi.hoisted(() => ({ list: [] as string[] }))

vi.mock('@/helpers/api/request', () => ({
  getByPRCWithAuth: (args: unknown) => rpc.call(args),
  getByPRC: (args: unknown) => rpc.call(args),
}))
vi.mock('@/stores/media-library-store', () => ({
  useMediaLibraryStore: () => ({ favoritesFor: async () => favIds.list }),
}))

import {
  buildFeedQueryByTab,
  buildHistoricalStripQuery,
  fetchRawPostsByIds,
  type FeedQueryContext,
} from './feed-queries'

interface SentRequest {
  method: string
  parameters: unknown[]
  cachehash: string
  options: Record<string, unknown>
  state: number
}

const ctx = (over: Partial<FeedQueryContext> = {}): FeedQueryContext => ({
  currentTxid: '',
  count: 10,
  lang: 'ru',
  allTags: ['tag1'],
  contentTypes: ['share'],
  userAddress: 'PUser',
  topFirst: false,
  depth: 4320,
  ...over,
})

/** Последний запрос, ушедший на ноду. */
const lastRequest = (): SentRequest =>
  rpc.call.mock.calls[rpc.call.mock.calls.length - 1]![0] as SentRequest

/** Последний параметр запроса: адрес, окно в блоках или минутах. */
const lastParam = (req: SentRequest): unknown => req.parameters[req.parameters.length - 1]

beforeEach(() => {
  rpc.call.mockReset()
  rpc.call.mockResolvedValue({ data: { contents: [] } })
  favIds.list = []
})

describe('buildFeedQueryByTab — выбор метода по вкладке', () => {
  it('лента по дате: gethistoricalstrip, язык и теги ленты, адрес — последним', async () => {
    await buildFeedQueryByTab(1, ctx())
    const req = lastRequest()
    expect(req.method).toBe('gethistoricalstrip')
    expect(req.parameters).toEqual([0, '', 10, 'ru', ['tag1'], ['share'], [], [], [], '', 'PUser'])
    expect(req.options).toMatchObject({ ex: true })
    expect(req.state).toBe(1)
  })

  it('подписки: getsubscribesfeed на всех языках — язык не передаётся', async () => {
    await buildFeedQueryByTab(2, ctx({ lang: 'de' }))
    const req = lastRequest()
    expect(req.method).toBe('getsubscribesfeed')
    expect(req.parameters[3]).toBe('')
    expect(lastParam(req)).toBe('PUser')
  })

  it('обсуждаемое: getmostcommentedfeed за сутки, всегда мимо кэша', async () => {
    await buildFeedQueryByTab(7, ctx())
    const req = lastRequest()
    expect(req.method).toBe('getmostcommentedfeed')
    expect(req.parameters[3]).toBe('ru')
    expect(lastParam(req)).toBe(1440)
    expect(req.options).toMatchObject({ ex: true, cache: false })
  })

  it('избранное: идёт в личный список и тянет посты по id, а не ленту ноды', async () => {
    favIds.list = ['f1']
    rpc.call.mockResolvedValue([{ txid: 'f1' }])
    const res = await buildFeedQueryByTab(6, ctx())
    expect(lastRequest().method).toBe('getrawtransactionwithmessagebyid')
    expect(lastRequest().parameters).toEqual([['f1']])
    expect(res.data.contents).toEqual([{ txid: 'f1' }])
  })

  it.each([1, 3, 4, 5])(
    '«Сначала лучшее» на вкладке %i: gettopfeed с окном в блоках последним',
    async (tab) => {
      await buildFeedQueryByTab(tab, ctx({ topFirst: true, depth: 1440 }))
      const req = lastRequest()
      expect(req.method).toBe('gettopfeed')
      expect(lastParam(req)).toBe(1440)
      expect(req.parameters[3]).toBe('ru')
    }
  )

  it('«Сначала лучшее» не влияет на подписки и обсуждаемое', async () => {
    await buildFeedQueryByTab(2, ctx({ topFirst: true }))
    expect(lastRequest().method).toBe('getsubscribesfeed')
    await buildFeedQueryByTab(7, ctx({ topFirst: true }))
    expect(lastRequest().method).toBe('getmostcommentedfeed')
  })
})

describe('пагинация и кэш', () => {
  it('следующая страница — от последнего поста и на высоте первой страницы', async () => {
    for (const [tab, topFirst] of [
      [1, false],
      [1, true],
      [2, false],
      [7, false],
    ] as const) {
      await buildFeedQueryByTab(tab, ctx({ topFirst, currentTxid: 'LAST', height: 3_000_000 }))
      const [height, txid] = lastRequest().parameters
      expect(height).toBe(3_000_000)
      expect(txid).toBe('LAST')
    }
  })

  it('без высоты — первая страница «от последнего блока» (0)', async () => {
    await buildFeedQueryByTab(1, ctx({ height: undefined }))
    expect(lastRequest().parameters[0]).toBe(0)
  })

  it('каждый запрос несёт свой cachehash — ответ не берётся из серверного кэша', async () => {
    await buildFeedQueryByTab(1, ctx())
    const first = lastRequest().cachehash
    await buildFeedQueryByTab(1, ctx())
    expect(first).toBeTruthy()
    expect(lastRequest().cachehash).not.toBe(first)
  })

  it('пробный запрос ленты по дате передаёт ограничение по нодам', async () => {
    await buildHistoricalStripQuery(ctx(), 1)
    expect(lastRequest().options).toMatchObject({ ex: true, nodeTimeouts: 1 })
  })

  it('ответ ноды возвращается как есть, ошибка — пробрасывается вызывающему', async () => {
    const response = { data: { contents: [{ txid: 'a' }], height: 5 } }
    rpc.call.mockResolvedValueOnce(response)
    await expect(buildFeedQueryByTab(1, ctx())).resolves.toBe(response)
    rpc.call.mockRejectedValueOnce(new Error('timeout'))
    await expect(buildFeedQueryByTab(2, ctx())).rejects.toThrow('timeout')
  })
})

describe('fetchRawPostsByIds', () => {
  it('пустой список id — без запроса к ноде', async () => {
    const map = await fetchRawPostsByIds([])
    expect(map.size).toBe(0)
    expect(rpc.call).not.toHaveBeenCalled()
  })

  it.each([
    ['голый массив', [{ txid: 'a' }]],
    ['{ data }', { data: [{ txid: 'a' }] }],
    ['{ result }', { result: [{ txid: 'a' }] }],
  ])('понимает ответ вида %s', async (_label, response) => {
    rpc.call.mockResolvedValueOnce(response)
    const map = await fetchRawPostsByIds(['a'])
    expect(map.get('a')).toEqual({ txid: 'a' })
  })

  it('неожиданный ответ — пустая карта, а не исключение', async () => {
    for (const response of [null, 'oops', { data: 'x' }, 42]) {
      rpc.call.mockResolvedValueOnce(response)
      expect((await fetchRawPostsByIds(['a'])).size).toBe(0)
    }
  })

  it('удалённые посты (null) пропускаются, остальные находятся', async () => {
    rpc.call.mockResolvedValueOnce([null, { txid: 'b' }, 'мусор'])
    const map = await fetchRawPostsByIds(['a', 'b'])
    expect([...map.keys()]).toEqual(['b'])
  })

  it('пост находится по любому своему id: txid, hash или числовому id', async () => {
    const post = { txid: 'tx', hash: 'h', id: 7 }
    rpc.call.mockResolvedValueOnce([post])
    const map = await fetchRawPostsByIds(['tx'])
    expect(map.get('tx')).toBe(post)
    expect(map.get('h')).toBe(post)
    expect(map.get('7')).toBe(post)
  })

  it('при совпадении id у двух постов побеждает первый из ответа', async () => {
    const first = { txid: 'x', hash: 'shared' }
    const second = { txid: 'y', hash: 'shared' }
    rpc.call.mockResolvedValueOnce([first, second])
    const map = await fetchRawPostsByIds(['x', 'y'])
    expect(map.get('shared')).toBe(first)
    expect(map.get('y')).toBe(second)
  })
})
