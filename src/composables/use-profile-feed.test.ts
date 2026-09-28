// Лента профиля: первая страница и догрузка по txid последнего поста, конец
// ленты по короткой странице, профиль автора из ответа, оригиналы репостов,
// «Обновить» с головы (S17) и страница прошлого поколения, опоздавшая из-за
// догрузки репостов, не доклеивается (S16). В своём профиле — свои
// неподтверждённые посты сверху без дублей и сверка pending-слоя. Страница
// отдаётся, когда у авторов последних комментариев уже есть имена.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref, shallowRef } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  data: null as unknown as { value: unknown },
  error: null as unknown as { value: unknown },
  isLoading: null as unknown as { value: boolean },
  refetch: vi.fn(),
  options: null as null | { queryKey: { value: unknown[] }; queryFn: () => Promise<unknown> },
  rpcCallWithAuth: vi.fn(),
  mergeRepostContent: vi.fn(),
  auth: null as unknown as { getUserAddress: string | null; getUserProfile: unknown },
  pending: [] as Array<{ id: string; txid?: string }>,
  reconcile: vi.fn(),
  cleanupExpired: vi.fn(),
  onConfirmed: null as null | (() => void),
  preloadAuthors: vi.fn<(contents: unknown) => Promise<void>>(),
}))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: (options: typeof mocks.options) => {
    mocks.options = options
    return {
      data: mocks.data,
      isLoading: mocks.isLoading,
      error: mocks.error,
      refetch: mocks.refetch,
    }
  },
}))
vi.mock('@/helpers/api/request', () => ({ rpcCallWithAuth: mocks.rpcCallWithAuth }))
vi.mock('@/composables/use-feed', () => ({
  extractPostsFromResponse: (resp: { contents: Array<{ txid?: string; repost?: string }> }) =>
    resp.contents
      .filter((c) => c.txid)
      .map((c) => ({ id: c.txid, txid: c.txid, repost: c.repost })),
  mergeRepostContent: mocks.mergeRepostContent,
}))
vi.mock('@/composables/helpers/feed-enrichment', () => ({
  preloadLastCommentAuthors: (contents: unknown) => mocks.preloadAuthors(contents),
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/stores', () => ({
  usePendingPostsStore: () => ({
    getPendingForAddress: () => mocks.pending,
    reconcileWithServer: mocks.reconcile,
    cleanupExpired: mocks.cleanupExpired,
  }),
}))
vi.mock('@/composables/pending-post-adapter', () => ({
  pendingPostToAdapted: (p: { id: string; txid?: string }) => ({
    id: p.id,
    txid: p.txid,
    pending: true,
  }),
}))
vi.mock('@/helpers/common/current-user-author', () => ({
  buildCurrentUserAuthor: () => ({ name: 'me' }),
}))
vi.mock('@/composables/use-pending-posts-realtime', () => ({
  usePendingPostsRealtime: (opts: { onConfirmed: () => void }) => {
    mocks.onConfirmed = opts.onConfirmed
  },
}))

import { useProfileFeed, type UseProfileFeedOptions } from './use-profile-feed'

type Feed = ReturnType<typeof useProfileFeed>
const mounted: VueWrapper[] = []

function setup(options: Partial<UseProfileFeedOptions> = {}): Feed {
  let feed!: Feed
  mounted.push(
    mount(
      defineComponent({
        setup() {
          feed = useProfileFeed({ address: 'PAuthor', initialLimit: 3, pageSize: 3, ...options })
          return () => h('div')
        },
      })
    )
  )
  return feed
}

const posts = (...ids: string[]) => ids.map((txid) => ({ txid }))
const ids = (feed: Feed) => feed.allPosts.value.map((p) => p.id)

/** Нода ответила страницей; ждём и синхронный разбор, и догрузку репостов. */
async function answer(contents: unknown[]) {
  mocks.data.value = { contents }
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useProfileFeed', () => {
  beforeEach(() => {
    mocks.data = shallowRef<unknown>(undefined)
    mocks.error = ref<unknown>(null)
    mocks.isLoading = ref(false)
    mocks.refetch.mockReset().mockResolvedValue(undefined)
    mocks.rpcCallWithAuth.mockReset().mockResolvedValue({ contents: [] })
    mocks.mergeRepostContent.mockReset()
    mocks.auth = reactive({ getUserAddress: 'PMe', getUserProfile: null })
    mocks.pending = []
    mocks.reconcile.mockReset()
    mocks.cleanupExpired.mockReset()
    mocks.onConfirmed = null
    mocks.preloadAuthors.mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    vi.restoreAllMocks()
  })

  it('запрос: getprofilefeed по адресу автора, первая страница — initialLimit', async () => {
    setup({ lang: 'en' })
    expect(mocks.options!.queryKey.value).toEqual(['feed', 'profile', 'PAuthor', 'initial'])
    await mocks.options!.queryFn()
    const req = mocks.rpcCallWithAuth.mock.lastCall![0]
    expect(req.method).toBe('getprofilefeed')
    expect(req.parameters[1]).toBe('')
    expect(req.parameters[2]).toBe(3)
    expect(req.parameters[3]).toBe('en')
    expect(req.parameters[10]).toBe('PAuthor')
    expect(req.options).toEqual({ ex: true })
  })

  it('страница отдаётся, когда у авторов последних комментариев уже есть имена', async () => {
    setup()
    const contents = [{ txid: 'p1', lastComment: { address: 'PCommenter' } }]
    mocks.rpcCallWithAuth.mockResolvedValue({ contents })
    const gate: { release?: () => void } = {}
    mocks.preloadAuthors.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          gate.release = resolve
        })
    )
    let resolved = false
    const request = mocks.options!.queryFn().then((response) => {
      resolved = true
      return response
    })
    await vi.waitFor(() => expect(mocks.preloadAuthors).toHaveBeenCalledWith(contents))
    await Promise.resolve()
    expect(resolved).toBe(false)

    gate.release?.()
    await expect(request).resolves.toEqual({ contents })
  })

  it('полная страница — есть продолжение; «ещё» просит страницу после последнего поста', async () => {
    const feed = setup()
    await answer([{ name: 'Автор', address: 'PAuthor' }, ...posts('p1', 'p2', 'p3')])
    expect(ids(feed)).toEqual(['p1', 'p2', 'p3'])
    expect(feed.userProfile.value).toMatchObject({ name: 'Автор' })
    expect(feed.hasMore.value).toBe(true)

    await feed.loadMore()
    expect(feed.isLoadingMore.value).toBe(true)
    expect(mocks.options!.queryKey.value).toEqual(['feed', 'profile', 'PAuthor', 'p3'])

    await answer(posts('p3', 'p4', 'p5'))
    expect(ids(feed)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(feed.isLoadingMore.value).toBe(false)
  })

  it('короткая или пустая страница — конец ленты, «ещё» больше не запрашивает', async () => {
    const feed = setup()
    await answer(posts('p1', 'p2', 'p3'))
    await feed.loadMore()
    await answer(posts('p4'))
    expect(feed.hasMore.value).toBe(false)

    await feed.loadMore()
    expect(mocks.options!.queryKey.value).toEqual(['feed', 'profile', 'PAuthor', 'p3'])
  })

  it('следующая страница без contents — конец и спиннер снят', async () => {
    const feed = setup()
    await answer(posts('p1', 'p2', 'p3'))
    await feed.loadMore()
    mocks.data.value = {}
    await nextTick()
    expect(feed.hasMore.value).toBe(false)
    expect(feed.isLoadingMore.value).toBe(false)
  })

  it('репосты: оригиналы догружаются одним запросом и вливаются в посты', async () => {
    mocks.rpcCallWithAuth.mockResolvedValue([{ txid: 'orig1', m: 'оригинал' }])
    const feed = setup()
    await answer([{ txid: 'r1', repost: 'orig1' }, { txid: 'r2', repost: 'orig1' }, { txid: 'p3' }])
    await vi.waitFor(() => expect(ids(feed)).toEqual(['r1', 'r2', 'p3']))
    expect(mocks.rpcCallWithAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'getrawtransactionwithmessagebyid',
        parameters: [['orig1']],
      })
    )
    expect(mocks.mergeRepostContent).toHaveBeenCalledTimes(2)
  })

  it('«Обновить» во время догрузки репостов: старая страница не доклеивается (S16)', async () => {
    let finishOriginals!: (v: unknown) => void
    mocks.rpcCallWithAuth.mockReturnValueOnce(new Promise((resolve) => (finishOriginals = resolve)))
    const feed = setup()
    mocks.data.value = { contents: [{ txid: 'stale', repost: 'orig' }] }
    await nextTick()

    await feed.refetch()
    finishOriginals([])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ids(feed)).toEqual([])
  })

  it('«Обновить» после «ещё» — снова с головы, а не текущая страница (S17)', async () => {
    const feed = setup()
    await answer(posts('p1', 'p2', 'p3'))
    await feed.loadMore()
    await feed.refetch()
    expect(mocks.options!.queryKey.value).toEqual(['feed', 'profile', 'PAuthor', 'initial'])
    expect(mocks.refetch).not.toHaveBeenCalled()

    await feed.refetch()
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
    expect(feed.hasMore.value).toBe(true)
  })

  it('ошибка сети снимает спиннер догрузки', async () => {
    const feed = setup()
    await answer(posts('p1', 'p2', 'p3'))
    await feed.loadMore()
    mocks.error.value = new Error('offline')
    await nextTick()
    expect(feed.isLoadingMore.value).toBe(false)
  })

  describe('свой профиль', () => {
    it('неподтверждённые посты сверху, без дублей; pending-слой сверяется с лентой', async () => {
      mocks.auth.getUserAddress = 'PAuthor'
      mocks.pending = [
        { id: 'tx-new', txid: 'tx-new' },
        { id: 'p1', txid: 'p1' },
      ]
      const feed = setup()
      await answer(posts('p1', 'p2'))
      expect(feed.allPosts.value.map((p) => p.id)).toEqual(['tx-new', 'p1', 'p2'])
      expect(mocks.reconcile).toHaveBeenCalledWith('PAuthor', new Set(['p1', 'p2']))
      expect(mocks.cleanupExpired).toHaveBeenCalled()
    })

    it('подтверждение по WebSocket перезагружает свою ленту с головы', async () => {
      mocks.auth.getUserAddress = 'PAuthor'
      setup()
      mocks.onConfirmed!()
      await nextTick()
      expect(mocks.refetch).toHaveBeenCalledTimes(1)
    })

    it('в чужом профиле чужие pending не показываются и не сверяются', async () => {
      mocks.pending = [{ id: 'tx-new', txid: 'tx-new' }]
      const feed = setup()
      await answer(posts('p1'))
      expect(ids(feed)).toEqual(['p1'])
      expect(mocks.reconcile).not.toHaveBeenCalled()
      mocks.onConfirmed!()
      expect(mocks.refetch).not.toHaveBeenCalled()
    })
  })
})
