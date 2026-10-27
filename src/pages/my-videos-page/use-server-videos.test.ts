// «Медиастудия»: по серверу на рой, на каждом свой список, плюс ролики из своих
// постов на любых серверах; что уже в постах — по ноде; обработка у сервера
// ещё идёт — видно; сервер не ответил — остальные всё равно показаны; удалить —
// с сервера и из списка; пост с роликом попал в блок — «В посте» без
// перезагрузки.

import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { privateKey: 'k' } as unknown, getUserAddress: 'PMe' as string | null },
  hosts: vi.fn(),
  token: vi.fn(async ({ host }: { host: string }) => ({ access_token: `T-${host}` })),
  list: vi.fn(),
  posted: vi.fn(),
  del: vi.fn(),
  postsPage: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/services/peertube/peertube-host', () => ({ resolvePeertubeHosts: mocks.hosts }))
vi.mock('@/services/peertube/peertube-auth', () => ({
  buildPeertubeSignature: () => ({ signature: 's' }),
  ensurePeertubeToken: mocks.token,
}))
vi.mock('@/services/peertube/peertube-videos', () => ({
  getMyAccountVideos: mocks.list,
  findPostedVideos: mocks.posted,
  deleteInstanceVideo: mocks.del,
  getPostedVideosPage: mocks.postsPage,
  getVideosInfo: mocks.info,
}))

import { PENDING_POST_TTL_MS, usePendingPostsStore } from '@/stores/pending-posts-store'
import { HOST_SLOW_MS, POSTS_SOURCE, useServerVideos } from './use-server-videos'

const posts = (entries: Record<string, string[]>) =>
  new Map(
    Object.entries(entries).map(([url, txids]) => [
      url,
      txids.map((txid, i) => ({ txid, caption: 'Пост', time: (i + 1) * 1000 })),
    ])
  )

/** Ответ сервера, который придёт, когда тест скажет. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('useServerVideos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.auth.getKeyPair = { privateKey: 'k' }
    mocks.auth.getUserAddress = 'PMe'
    mocks.hosts.mockResolvedValue(['a.host', 'b.host'])
    mocks.list.mockImplementation(async ({ host }: { host: string }) =>
      host === 'a.host'
        ? {
            total: 2,
            data: [
              {
                id: 1,
                uuid: 'u1',
                name: 'Море',
                thumbnailPath: '/t/1.jpg',
                duration: 75,
                state: { id: 1 },
              },
              { id: 2, uuid: 'u2', name: 'Горы', state: { id: 2 } },
            ],
          }
        : { total: 1, data: [{ id: 7, uuid: 'u7', name: 'Лес', state: { id: 1 } }] }
    )
    mocks.posted.mockResolvedValue(posts({ 'peertube://a.host/u1': ['p1'] }))
    mocks.postsPage.mockResolvedValue({ videos: [], next: null })
    mocks.info.mockResolvedValue(new Map())
  })

  it('ролики со всех серверов роёв: обложка, длительность, обработка, «в посте»', async () => {
    const api = useServerVideos()
    await api.load()
    expect(mocks.list).toHaveBeenCalledWith({ host: 'a.host', accessToken: 'T-a.host', count: 30 })
    expect(api.videos.value.map((v) => [v.pointer, v.processing, v.posted])).toEqual([
      ['peertube://a.host/u1', false, true],
      ['peertube://a.host/u2', true, false],
      ['peertube://b.host/u7', false, false],
    ])
    expect(api.videos.value[0]).toMatchObject({
      thumbnailUrl: 'https://a.host/t/1.jpg',
      duration: 75,
      name: 'Море',
    })
    expect(api.failedHosts.value).toEqual([])
    expect(api.loaded.value).toBe(true)
  })

  it('один сервер не ответил — остальные показаны, сбой виден', async () => {
    mocks.list.mockImplementation(async ({ host }: { host: string }) => {
      if (host === 'b.host') throw new Error('peertube_my_videos_502')
      return { total: 1, data: [{ id: 1, uuid: 'u1', name: 'Море' }] }
    })
    const api = useServerVideos()
    await api.load()
    expect(api.videos.value.map((v) => v.pointer)).toEqual(['peertube://a.host/u1'])
    expect(api.failedHosts.value).toEqual(['b.host'])
  })

  it('медленный сервер не держит список: быстрые видны сразу, его ролики добавятся, когда ответит', async () => {
    vi.useFakeTimers()
    try {
      const slow = deferred<{ total: number; data: unknown[] }>()
      mocks.list.mockImplementation(async ({ host }: { host: string }) =>
        host === 'a.host'
          ? slow.promise
          : { total: 1, data: [{ id: 7, uuid: 'u7', name: 'Лес', state: { id: 1 } }] }
      )
      const api = useServerVideos()
      const loading = api.load()

      await vi.waitFor(() =>
        expect(api.videos.value.map((v) => v.pointer)).toEqual(['peertube://b.host/u7'])
      )
      expect(api.loading.value).toBe(true)

      await vi.advanceTimersByTimeAsync(HOST_SLOW_MS)
      expect(api.loading.value).toBe(false)
      expect(api.loaded.value).toBe(true)
      expect(api.failedHosts.value).toEqual(['a.host'])

      slow.resolve({ total: 1, data: [{ id: 1, uuid: 'u1', name: 'Море', state: { id: 1 } }] })
      await loading
      // Порядок — по роям, а не по тому, кто ответил первым.
      expect(api.videos.value.map((v) => v.pointer)).toEqual([
        'peertube://a.host/u1',
        'peertube://b.host/u7',
      ])
      expect(api.videos.value[0]!.posted).toBe(true)
      expect(api.failedHosts.value).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('«Обновить» не прячет прежний список, пока серверы отвечают', async () => {
    const api = useServerVideos()
    await api.load()
    const slow = deferred<{ total: number; data: unknown[] }>()
    mocks.list.mockImplementation(() => slow.promise)
    const loading = api.load()
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(4))
    expect(api.videos.value).toHaveLength(3)
    slow.resolve({ total: 0, data: [] })
    await loading
    expect(api.videos.value).toEqual([])
  })

  it('другой аккаунт не видит ролики прежнего, пока серверы отвечают', async () => {
    const api = useServerVideos()
    await api.load()
    mocks.auth.getUserAddress = 'POther'
    mocks.list.mockRejectedValue(new Error('peertube_my_videos_502'))
    await api.load()
    expect(api.videos.value).toEqual([])
  })

  it('не вошли — ничего не запрашивается', async () => {
    mocks.auth.getKeyPair = null
    const api = useServerVideos()
    expect(api.signedIn.value).toBe(false)
    await api.load()
    expect(mocks.hosts).not.toHaveBeenCalled()
  })

  it('удалить — запрос на свой сервер и ролик уходит из списка', async () => {
    const api = useServerVideos()
    await api.load()
    await api.remove(api.videos.value[2]!)
    expect(mocks.del).toHaveBeenCalledWith({ host: 'b.host', id: 7, accessToken: 'T-b.host' })
    expect(api.videos.value.map((v) => v.uuid)).toEqual(['u1', 'u2'])
  })

  it('ролики из постов на любых серверах: без повторов, посты вместе, свежие первыми', async () => {
    mocks.list.mockImplementation(async ({ host }: { host: string }) =>
      host === 'a.host'
        ? {
            total: 1,
            data: [{ id: 1, uuid: 'u1', name: 'Море', createdAt: '2026-10-01T00:00:00Z' }],
          }
        : { total: 0, data: [] }
    )
    mocks.postsPage
      .mockResolvedValueOnce({
        videos: [
          {
            pointer: 'peertube://old.host/u9/audio',
            post: { txid: 'p9', caption: 'Старый подкаст', time: Date.parse('2025-01-01') },
          },
          {
            pointer: 'peertube://a.host/u1',
            post: { txid: 'p2', caption: 'Море ещё раз', time: 5000 },
          },
        ],
        next: 'p2',
      })
      .mockResolvedValueOnce({ videos: [], next: null })
    mocks.info.mockResolvedValue(
      new Map([
        [
          'peertube://old.host/u9/audio',
          {
            id: 90,
            name: 'Подкаст',
            thumbnailPath: '/t/9.jpg',
            duration: 600,
            state: { id: 1 },
            createdAt: '2025-01-01T00:00:00Z',
          },
        ],
      ])
    )

    const api = useServerVideos()
    await api.load()

    expect(mocks.postsPage).toHaveBeenNthCalledWith(2, { address: 'PMe', after: 'p2', count: 50 })
    expect(api.videos.value.map((v) => [v.pointer, v.posted])).toEqual([
      ['peertube://a.host/u1', true],
      ['peertube://old.host/u9/audio', true],
    ])
    expect(api.videos.value[0]!.posts.map((p) => p.txid)).toEqual(['p2', 'p1'])
    expect(api.videos.value[1]).toMatchObject({
      host: 'old.host',
      id: 90,
      name: 'Подкаст',
      thumbnailUrl: 'https://old.host/t/9.jpg',
      duration: 600,
      posts: [{ txid: 'p9' }],
    })
  })

  it('посты не пришли — ролики с серверов видны, сбой виден', async () => {
    mocks.postsPage.mockRejectedValue(new Error('rpc'))
    const api = useServerVideos()
    await api.load()
    expect(api.videos.value).toHaveLength(3)
    expect(api.failedHosts.value).toEqual([POSTS_SOURCE])
  })

  describe('пост с роликом ждёт блока', () => {
    function pending(url: string) {
      const now = Date.now()
      usePendingPostsStore().addPending({
        id: 'tx-new',
        address: 'PMe',
        caption: 'Лес',
        message: '',
        images: [],
        tags: [],
        url,
        type: 'video',
        createdAt: now,
        expiresAt: now + PENDING_POST_TTL_MS,
      })
    }

    it('«Публикуется», а попал в блок — «В посте» без перезагрузки', async () => {
      const scope = effectScope()
      const api = scope.run(() => useServerVideos())!
      await api.load()
      const forest = () => api.videos.value.find((v) => v.uuid === 'u7')!
      expect(forest().posted).toBe(false)

      pending('peertube://b.host/u7')
      expect(api.isPublishing(forest())).toBe(true)

      mocks.posted.mockResolvedValue(posts({ 'peertube://b.host/u7': ['tx-new'] }))
      usePendingPostsStore().applyConfirmedTx('tx-new')
      await vi.waitFor(() => expect(forest().posted).toBe(true))
      expect(forest().posts.map((p) => p.txid)).toEqual(['tx-new'])
      expect(api.isPublishing(forest())).toBe(false)
      expect(mocks.posted).toHaveBeenLastCalledWith({ urls: ['peertube://b.host/u7'] })
      scope.stop()
    })

    it('нода ещё не видит пост в блоке — спросит снова', async () => {
      vi.useFakeTimers()
      const scope = effectScope()
      try {
        const api = scope.run(() => useServerVideos())!
        await api.load()
        pending('peertube://b.host/u7')
        mocks.posted.mockResolvedValue(new Map())
        usePendingPostsStore().applyConfirmedTx('tx-new')
        await vi.advanceTimersByTimeAsync(0)
        const forest = () => api.videos.value.find((v) => v.uuid === 'u7')!
        expect(forest().posted).toBe(false)

        mocks.posted.mockResolvedValue(posts({ 'peertube://b.host/u7': ['tx-new'] }))
        await vi.advanceTimersByTimeAsync(5_000)
        expect(forest().posted).toBe(true)
      } finally {
        scope.stop()
        vi.useRealTimers()
      }
    })

    it('ожидание снято по сроку, а поста нет — остаётся «Не в посте»', async () => {
      vi.useFakeTimers()
      const scope = effectScope()
      try {
        const api = scope.run(() => useServerVideos())!
        await api.load()
        pending('peertube://b.host/u7')
        mocks.posted.mockResolvedValue(new Map())
        usePendingPostsStore().cleanupExpired(Date.now() + PENDING_POST_TTL_MS + 1)
        await vi.advanceTimersByTimeAsync(30_000)
        const forest = api.videos.value.find((v) => v.uuid === 'u7')!
        expect(forest.posted).toBe(false)
        expect(api.isPublishing(forest)).toBe(false)
        // Сразу, через 5 и через 20 секунд — и больше не спрашивает.
        expect(mocks.posted).toHaveBeenCalledTimes(2 + 3)
      } finally {
        scope.stop()
        vi.useRealTimers()
      }
    })
  })
})
