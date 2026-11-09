// Ленты разделов «Видео» и «Аудио»: что спрашивается у ноды для каждой
// вкладки, только ролики своего типа без повторов и заблокированных, конец
// ленты, смена вкладки посреди запроса не смешивает ленты, поиск треков.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import type { AdaptedPost } from '@/composables/use-feed'

const m = vi.hoisted(() => ({
  auth: { getUserAddress: 'PMe' as string | null },
  ui: { contentLanguage: 'ru' },
  blocked: new Set<string>(),
  fetchDatePage: vi.fn(),
  buildTopFeedQuery: vi.fn(),
  buildSubscriptionsFeedQuery: vi.fn(),
  getByPRCWithAuth: vi.fn(),
  rpcCall: vi.fn(),
  fetchMediaInfo: vi.fn(),
  searchAudio: vi.fn(),
  preload: vi.fn(),
}))

vi.mock('@/blockchain', () => ({ useAuthStore: () => m.auth }))
vi.mock('@/stores/ui-store', () => ({ useUIStore: () => m.ui }))
vi.mock('@/composables/use-blocked-authors', () => ({
  useBlockedAuthors: () => ({
    filterBlocked: <T extends { author?: { address?: string } }>(posts: T[]) =>
      posts.filter((p) => !m.blocked.has(p.author?.address ?? '')),
  }),
}))
// Ответ ноды в тестах — уже готовые посты в data.contents.
vi.mock('@/composables/use-feed', () => ({
  extractPostsFromResponse: (r: { data?: { contents?: unknown[] } } | null) =>
    r?.data?.contents ?? [],
}))
vi.mock('@/composables/helpers/feed-queries', () => ({
  buildTopFeedQuery: m.buildTopFeedQuery,
  buildSubscriptionsFeedQuery: m.buildSubscriptionsFeedQuery,
}))
vi.mock('@/composables/helpers/date-feed', () => ({ fetchDatePage: m.fetchDatePage }))
vi.mock('@/composables/helpers/feed-enrichment', () => ({ preloadLastCommentAuthors: m.preload }))
vi.mock('@/helpers/api/request', () => ({
  getByPRCWithAuth: m.getByPRCWithAuth,
  rpcCall: m.rpcCall,
}))
vi.mock('@/services/media/media-info', () => ({ fetchMediaInfo: m.fetchMediaInfo }))
vi.mock('@/services/media/audio-search', () => ({ searchAudio: m.searchAudio }))

import { useMediaFeed, type MediaFeedSource } from './use-media-feed'

type Post = Partial<AdaptedPost>
const video = (n: number, over: Post = {}): Post => ({
  txid: `v${n}`,
  type: 'video',
  videoUrl: `peertube://v.example/${n}`,
  author: { address: `PA${n}` } as AdaptedPost['author'],
  ...over,
})
const audio = (n: number): Post => ({
  txid: `a${n}`,
  type: 'audio',
  videoUrl: `peertube://v.example/a${n}`,
  author: { address: `PA${n}` } as AdaptedPost['author'],
})
const strip = (posts: Post[], height = 0) => ({ data: { contents: posts, height } })
const range = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => video(from + i))

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

function feed(opts: {
  type?: 'video' | 'audio'
  source?: MediaFeedSource
  query?: string
  author?: string
  tags?: string[]
  enabled?: boolean
  pageSize?: number
}) {
  const source = ref<MediaFeedSource>(opts.source ?? 'fresh')
  const query = ref(opts.query ?? '')
  const author = ref(opts.author ?? '')
  const tags = ref(opts.tags ?? [])
  const enabled = ref(opts.enabled ?? true)
  const api = effectScope().run(() =>
    useMediaFeed({
      type: opts.type ?? 'video',
      source,
      query,
      author,
      tags,
      enabled,
      pageSize: opts.pageSize ?? 3,
    })
  )!
  return { ...api, source, query, author, tags, enabled }
}

beforeEach(() => {
  m.auth = reactive({ getUserAddress: 'PMe' })
  m.ui = reactive({ contentLanguage: 'ru' })
  m.blocked = new Set()
  for (const fn of [
    m.fetchDatePage,
    m.buildTopFeedQuery,
    m.buildSubscriptionsFeedQuery,
    m.getByPRCWithAuth,
    m.rpcCall,
    m.fetchMediaInfo,
    m.searchAudio,
    m.preload,
  ])
    fn.mockReset()
  m.fetchMediaInfo.mockResolvedValue(new Map())
  m.preload.mockResolvedValue(undefined)
})

describe('«Свежее»', () => {
  it('первая страница — по дате, с языком, типом и тегами рубрики', async () => {
    m.fetchDatePage.mockResolvedValue({ response: strip(range(1, 3), 777), requested: 3 })
    const f = feed({ tags: ['Music', 'Rock & Roll'] })
    await flush()
    expect(m.fetchDatePage).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTxid: '',
        count: 3,
        lang: 'ru',
        contentTypes: ['video'],
        userAddress: 'PMe',
        allTags: ['music', 'rock%20%26%20roll'],
        height: 0,
      })
    )
    expect(f.posts.value.map((p) => p.txid)).toEqual(['v1', 'v2', 'v3'])
    expect(f.hasMore.value).toBe(true)
    expect(f.loading.value).toBe(false)
  })

  it('следующая страница — от последнего поста и с высотой первой', async () => {
    m.fetchDatePage
      .mockResolvedValueOnce({ response: strip(range(1, 3), 777), requested: 3 })
      .mockResolvedValueOnce({ response: strip(range(4, 1)), requested: 3 })
    const f = feed({})
    await flush()
    await f.loadMore()
    expect(m.fetchDatePage.mock.calls[1]![0]).toMatchObject({ currentTxid: 'v3', height: 777 })
    expect(f.posts.value).toHaveLength(4)
    // Пришло меньше, чем просили, — дальше пусто, новых запросов нет.
    expect(f.hasMore.value).toBe(false)
    await f.loadMore()
    expect(m.fetchDatePage).toHaveBeenCalledTimes(2)
  })

  it('только ролики этого раздела, без повторов и заблокированных авторов', async () => {
    m.blocked = new Set(['PA3'])
    m.fetchDatePage.mockResolvedValue({
      response: strip([
        video(1),
        audio(2),
        video(1),
        video(3),
        { txid: 't', type: 'share' },
        video(4, { videoUrl: 'https://youtube.com/x' }),
      ]),
      requested: 6,
    })
    const f = feed({})
    await flush()
    expect(f.posts.value.map((p) => p.txid)).toEqual(['v1'])
  })

  it('превью и длительности — одним запросом на страницу и только для роликов', async () => {
    m.fetchDatePage.mockResolvedValue({
      response: strip([video(1), { txid: 't', type: 'share' }, audio(2)]),
      requested: 3,
    })
    m.fetchMediaInfo.mockResolvedValue(new Map([['peertube://v.example/1', { duration: 61 }]]))
    const f = feed({})
    await flush()
    expect(m.fetchMediaInfo).toHaveBeenCalledWith([
      'peertube://v.example/1',
      'peertube://v.example/a2',
    ])
    expect(f.info.value.get('peertube://v.example/1')).toEqual({ duration: 61 })
  })

  it('ошибка ноды — признак ошибки, а не пустая лента навсегда', async () => {
    m.fetchDatePage.mockRejectedValueOnce(new Error('502'))
    const f = feed({})
    await flush()
    expect(f.error.value).toBe(true)
    expect(f.loading.value).toBe(false)
    m.fetchDatePage.mockResolvedValueOnce({ response: strip(range(1, 1)), requested: 3 })
    await f.loadMore()
    expect(f.error.value).toBe(false)
    expect(f.posts.value).toHaveLength(1)
  })
})

describe('вкладки', () => {
  it('«Лучшее» и «Подписки» — свои запросы к ноде', async () => {
    m.buildTopFeedQuery.mockResolvedValue(strip(range(1, 3)))
    m.buildSubscriptionsFeedQuery.mockResolvedValue(strip(range(10, 2)))
    const f = feed({ source: 'best' })
    await flush()
    expect(m.buildTopFeedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ currentTxid: '', contentTypes: ['video'] })
    )
    f.source.value = 'subscriptions'
    await flush()
    expect(m.buildSubscriptionsFeedQuery).toHaveBeenCalled()
    expect(f.posts.value.map((p) => p.txid)).toEqual(['v10', 'v11'])
  })

  it('ролики автора — getprofilefeed с адресом на месте 10 и типом раздела', async () => {
    m.getByPRCWithAuth.mockResolvedValue(strip(range(1, 3)))
    const f = feed({ source: 'author', author: 'PAuthor' })
    await flush()
    const [req] = m.getByPRCWithAuth.mock.calls[0]!
    expect(req.method).toBe('getprofilefeed')
    expect(req.parameters[10]).toBe('PAuthor')
    expect(req.parameters[5]).toEqual(['video'])
    expect(req.parameters[1]).toBe('')
    expect(f.hasMore.value).toBe(true)
    await f.loadMore()
    expect(m.getByPRCWithAuth.mock.calls[1]![0].parameters[1]).toBe('v3')
  })

  it('автор не выбран — пусто без запроса', async () => {
    const f = feed({ source: 'author' })
    await flush()
    expect(m.getByPRCWithAuth).not.toHaveBeenCalled()
    expect(f.posts.value).toEqual([])
    expect(f.hasMore.value).toBe(false)
  })

  it('смена вкладки посреди запроса — старый ответ не попадает в новую ленту', async () => {
    let finishOld: (v: unknown) => void = () => {}
    m.fetchDatePage.mockReturnValueOnce(new Promise((r) => (finishOld = r)))
    m.buildTopFeedQuery.mockResolvedValue(strip([video(50)]))
    const f = feed({})
    await flush()
    f.source.value = 'best'
    await flush()
    finishOld({ response: strip(range(1, 3)), requested: 3 })
    await flush()
    expect(f.posts.value.map((p) => p.txid)).toEqual(['v50'])
    expect(f.loading.value).toBe(false)
  })

  it('язык ленты сменился — лента с начала', async () => {
    m.fetchDatePage.mockResolvedValue({ response: strip(range(1, 3)), requested: 3 })
    feed({})
    await flush()
    m.ui.contentLanguage = 'en'
    await nextTick()
    await flush()
    expect(m.fetchDatePage).toHaveBeenCalledTimes(2)
    expect(m.fetchDatePage.mock.calls[1]![0]).toMatchObject({ lang: 'en', currentTxid: '' })
  })

  it('лента не на экране — не грузится, а на экране — сразу', async () => {
    m.fetchDatePage.mockResolvedValue({ response: strip(range(1, 3)), requested: 3 })
    const f = feed({ enabled: false })
    await flush()
    expect(m.fetchDatePage).not.toHaveBeenCalled()
    f.enabled.value = true
    await flush()
    expect(m.fetchDatePage).toHaveBeenCalledTimes(1)
  })
})

describe('поиск', () => {
  it('видео — search с типом videos и смещением страницы', async () => {
    m.rpcCall
      .mockResolvedValueOnce({ posts: { data: range(1, 3) } })
      .mockResolvedValueOnce({ posts: { data: range(4, 2) } })
    const f = feed({ source: 'search', query: '  котики ' })
    await flush()
    expect(m.rpcCall.mock.calls[0]![0]).toMatchObject({
      method: 'search',
      parameters: ['котики', 'videos', 0, 0, 3],
    })
    await f.loadMore()
    expect(m.rpcCall.mock.calls[1]![0].parameters).toEqual(['котики', 'videos', 0, 3, 3])
    expect(f.posts.value).toHaveLength(5)
    expect(f.hasMore.value).toBe(false)
  })

  it('пустая строка — без запроса', async () => {
    const f = feed({ source: 'search', query: '   ' })
    await flush()
    expect(m.rpcCall).not.toHaveBeenCalled()
    expect(f.hasMore.value).toBe(false)
  })

  it('треки — на PeerTube одним запросом, второй страницы нет', async () => {
    m.searchAudio.mockResolvedValue([audio(1), audio(2)])
    const f = feed({ type: 'audio', source: 'search', query: 'jazz' })
    await flush()
    expect(m.searchAudio).toHaveBeenCalledWith('jazz')
    expect(m.rpcCall).not.toHaveBeenCalled()
    expect(f.posts.value.map((p) => p.txid)).toEqual(['a1', 'a2'])
    expect(f.hasMore.value).toBe(false)
  })
})
