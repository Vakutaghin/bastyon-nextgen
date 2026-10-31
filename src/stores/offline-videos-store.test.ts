// Стор скачанного: список и события бэкенда, свои и чужие аккаунты на одном
// устройстве, постановка, удаление, «автор удалил», повтор после сети.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type {
  OfflineBackend,
  OfflineChanged,
  OfflineItem,
  OfflineMeta,
  OfflineProgress,
} from '@/services/offline-video/types'

const h = vi.hoisted(() => ({
  backend: null as OfflineBackend | null,
  auth: null as { getUserAddress: string | null; isUserAuthenticated: boolean } | null,
  info: vi.fn(),
  captions: vi.fn(async () => [] as unknown[]),
}))

vi.mock('@/services/offline-video/backend', () => ({
  offlineBackend: async () => h.backend,
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => h.auth }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => ({ shouldTorify: false }) }))
vi.mock('@/helpers/api/peertube-api', async (orig) => ({
  ...(await orig<typeof import('@/helpers/api/peertube-api')>()),
  getPeerTubeVideoInfo: h.info,
  getPeerTubeCaptions: h.captions,
}))

import { PeerTubeFetchError } from '@/helpers/api/peertube-api'
import { knownLocalCopy, resetOfflineLookup } from '@/services/offline-video/offline-lookup'
import { useOfflineVideosStore } from './offline-videos-store'

const UUID = 'aaaaaaaa-0000-4000-8000-000000000001'
const URL1 = `peertube://peertube701.pocketnet.app/${UUID}`

function meta(over: Partial<OfflineMeta> = {}): OfflineMeta {
  return {
    id: `${UUID}-144`,
    peertubeUrl: URL1,
    kind: 'video',
    uuid: UUID,
    title: 'Ролик',
    author: { address: 'PAuthor' },
    height: 144,
    size: 100,
    createdAt: 1,
    accounts: ['PMe'],
    ...over,
  }
}

function item(
  over: Partial<OfflineMeta> = {},
  status: OfflineItem['state']['status'] = 'done'
): OfflineItem {
  const m = meta(over)
  return { id: m.id, meta: m, state: { status, received: status === 'done' ? 100 : 0, total: 100 } }
}

function fake(initial: OfflineItem[] = []) {
  const items = new Map(initial.map((i) => [i.id, i]))
  let changed: (e: OfflineChanged) => void = () => {}
  let progress: (p: OfflineProgress) => void = () => {}
  const backend = {
    kind: 'tauri',
    list: vi.fn(async () => [...items.values()]),
    enqueue: vi.fn(async (job, m) => {
      const it: OfflineItem = {
        id: job.id,
        meta: m,
        state: { status: 'queued', received: 0, total: job.size },
      }
      items.set(job.id, it)
      return it
    }),
    pause: vi.fn(async () => {}),
    resume: vi.fn(async () => {}),
    remove: vi.fn(async (id: string) => void items.delete(id)),
    patchMeta: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const it = items.get(id)!
      const next = { ...it, meta: { ...it.meta, ...patch } as OfflineMeta }
      items.set(id, next)
      return next
    }),
    usage: vi.fn(async () => ({ used: 100, free: 10_000_000_000 })),
    clear: vi.fn(async () => items.clear()),
    fileUrl: vi.fn(
      async (id: string, file: string) => `bastyon-offline://localhost/${id}%2F${file}`
    ),
    onProgress: vi.fn(async (cb: (p: OfflineProgress) => void) => {
      progress = cb
      return () => {}
    }),
    onChanged: vi.fn(async (cb: (e: OfflineChanged) => void) => {
      changed = cb
      return () => {}
    }),
  } satisfies OfflineBackend
  return {
    backend,
    items,
    changed: (e: OfflineChanged) => changed(e),
    progress: (p: OfflineProgress) => progress(p),
  }
}

const SOURCE = {
  peertubeUrl: URL1,
  kind: 'video' as const,
  title: 'Ролик',
  author: { address: 'PAuthor', name: 'Автор' },
}

function videoInfo(state = 1) {
  return {
    id: 1,
    uuid: UUID,
    name: 'Ролик',
    state: { id: state },
    servedBy: 'peertube701.pocketnet.app',
    streamingPlaylists: [
      {
        id: 1,
        playlistUrl: 'https://peertube701.pocketnet.app/hls/master.m3u8',
        files: [
          {
            resolution: { id: 360, label: '360p' },
            size: 300,
            fileUrl: 'https://peertube701.pocketnet.app/hls/f-360.mp4',
          },
          {
            resolution: { id: 144, label: '144p' },
            size: 100,
            fileUrl: 'https://peertube701.pocketnet.app/hls/f-144.mp4',
          },
        ],
      },
    ],
  }
}

describe('offline-videos-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetOfflineLookup()
    h.auth = reactive({ getUserAddress: 'PMe', isUserAuthenticated: true })
    h.info.mockReset()
    h.captions.mockReset().mockResolvedValue([])
    localStorage.clear()
  })

  it('список: свои — свежие сверху; чужие не видны, но копия плееру известна', async () => {
    const f = fake([
      item({ id: 'a-144', uuid: 'a', peertubeUrl: 'peertube://h/a', createdAt: 1 }),
      item({ id: 'b-144', uuid: 'b', peertubeUrl: 'peertube://h/b', createdAt: 5 }),
      item({ id: 'c-144', uuid: 'c', peertubeUrl: 'peertube://h/c', accounts: ['POther'] }),
    ])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    expect(store.available).toBe(true)
    expect(store.mine.map((i) => i.id)).toEqual(['b-144', 'a-144'])
    expect(store.mineFor('peertube://h/c')).toBeNull()
    expect(store.itemFor('peertube://h/c')?.id).toBe('c-144')
    expect(knownLocalCopy('peertube://h/c')?.id).toBe('c-144')
  })

  it('события: ролик целиком и ход загрузки отдельно', async () => {
    const f = fake()
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    const queued = item({}, 'downloading')
    f.changed({ id: queued.id, item: queued })
    expect(store.mine).toHaveLength(1)
    f.progress({ id: queued.id, received: 40, total: 100 })
    expect(store.progress.get(queued.id)).toEqual({ received: 40, total: 100 })
    expect(knownLocalCopy(URL1)).toBeNull()
    f.changed({ id: queued.id, item: item() })
    expect(store.progress.has(queued.id)).toBe(false)
    expect(knownLocalCopy(URL1)?.id).toBe(queued.id)
    f.changed({ id: queued.id, item: null })
    expect(store.mine).toHaveLength(0)
    expect(knownLocalCopy(URL1)).toBeNull()
  })

  it('без бэкенда на платформе — недоступно, без ошибок', async () => {
    h.backend = null
    const store = useOfflineVideosStore()
    await store.hydrate()
    expect(store.available).toBe(false)
    expect(store.ready).toBe(true)
  })

  it('ролик в обработке и недоступная нода', async () => {
    h.backend = fake().backend
    const store = useOfflineVideosStore()
    h.info.mockResolvedValueOnce(videoInfo(2))
    expect(await store.prepare(SOURCE)).toEqual({ kind: 'processing' })
    h.info.mockRejectedValueOnce(new Error('down'))
    expect(await store.prepare(SOURCE)).toEqual({ kind: 'unavailable' })
  })

  it('выбор качества и постановка в очередь от своего аккаунта', async () => {
    const f = fake()
    h.backend = f.backend
    const store = useOfflineVideosStore()
    h.info.mockResolvedValue(videoInfo())
    const ready = await store.prepare(SOURCE)
    if (ready.kind !== 'ready') throw new Error('not ready')
    expect(ready.choice.qualities.map((q) => q.height)).toEqual([144, 360])
    expect(ready.choice.free).toBe(10_000_000_000)

    expect(store.autoQuality(ready.choice)).toBeNull()
    store.setQualityPref(240)
    expect(store.autoQuality(ready.choice)?.height).toBe(144)
    expect(localStorage.getItem('offline:quality')).toBe('240')
    expect(
      store.autoQuality({ ...ready.choice, source: { ...SOURCE, kind: 'audio' } })?.height
    ).toBe(144)

    const started = await store.start(ready.choice, ready.choice.qualities[1]!)
    expect(f.backend.enqueue).toHaveBeenCalledTimes(1)
    const [job, m] = f.backend.enqueue.mock.calls[0]!
    expect(job.id).toBe(`${UUID}-360`)
    expect(job.sources).toEqual(['https://peertube701.pocketnet.app/hls/f-360.mp4'])
    expect(m.accounts).toEqual(['PMe'])
    expect(store.mineFor(URL1)?.id).toBe(started.id)
  })

  it('файл уже скачал другой аккаунт — себя дописать, второй раз не качать', async () => {
    const f = fake([item({ accounts: ['POther'] })])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    h.info.mockResolvedValue(videoInfo())
    const ready = await store.prepare(SOURCE)
    if (ready.kind !== 'ready') throw new Error('not ready')
    await store.start(ready.choice, ready.choice.qualities[0]!)
    expect(f.backend.enqueue).not.toHaveBeenCalled()
    expect(f.items.get(`${UUID}-144`)!.meta.accounts).toEqual(['POther', 'PMe'])
    expect(store.mineFor(URL1)).not.toBeNull()
  })

  it('удалить у себя: общий файл остаётся другому, последний — стирается', async () => {
    const f = fake([item({ accounts: ['PMe', 'POther'] })])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    await store.remove(`${UUID}-144`)
    expect(f.backend.remove).not.toHaveBeenCalled()
    expect(f.items.get(`${UUID}-144`)!.meta.accounts).toEqual(['POther'])
    expect(store.mine).toHaveLength(0)

    h.auth!.getUserAddress = 'POther'
    await store.remove(`${UUID}-144`)
    expect(f.backend.remove).toHaveBeenCalledWith(`${UUID}-144`)
    expect(store.items.size).toBe(0)
  })

  it('аккаунт удалён с устройства — его адрес уходит, ненужный никому файл стирается', async () => {
    const f = fake([
      item({ id: 'a-144', uuid: 'a', peertubeUrl: 'peertube://h/a', accounts: ['PGone'] }),
      item({ id: 'b-144', uuid: 'b', peertubeUrl: 'peertube://h/b', accounts: ['PGone', 'PMe'] }),
    ])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.forgetAccount('PGone')
    expect(f.backend.remove).toHaveBeenCalledWith('a-144')
    expect(f.items.get('b-144')!.meta.accounts).toEqual(['PMe'])
  })

  it('выход из всех аккаунтов стирает всё', async () => {
    const f = fake([item()])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.clearAll()
    expect(f.backend.clear).toHaveBeenCalled()
    expect(store.items.size).toBe(0)
  })

  it('автор удалил: ролика нет нигде — пометка, файл остаётся; сбой сети — ничего', async () => {
    const f = fake([item()])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    const it = store.items.get(`${UUID}-144`)!

    h.info.mockRejectedValueOnce(new PeerTubeFetchError('net', 'timeout'))
    await store.checkDeleted(it, 50)
    expect(f.backend.patchMeta).not.toHaveBeenCalled()

    h.info.mockResolvedValueOnce(videoInfo())
    await store.checkDeleted(it, 60)
    expect(f.items.get(it.id)!.meta).toMatchObject({ checkedAt: 60 })
    expect(f.items.get(it.id)!.meta.authorDeleted).toBeUndefined()

    h.info.mockRejectedValueOnce(new PeerTubeFetchError('gone', 'not-found'))
    await store.checkDeleted(store.items.get(it.id)!, 70)
    expect(f.items.get(it.id)!.meta).toMatchObject({ authorDeleted: 70, checkedAt: 70 })
    expect(f.backend.remove).not.toHaveBeenCalled()
    expect(store.mine[0]!.meta.authorDeleted).toBe(70)
  })

  it('сеть вернулась — упавшее из-за сети продолжается само', async () => {
    const f = fake([
      {
        ...item({ id: 'n-144', uuid: 'n', peertubeUrl: 'peertube://h/n' }, 'failed'),
        state: { status: 'failed', received: 5, total: 100, error: 'network' },
      },
      {
        ...item({ id: 'x-144', uuid: 'x', peertubeUrl: 'peertube://h/x' }, 'failed'),
        state: { status: 'failed', received: 5, total: 100, error: 'hash_mismatch' },
      },
    ])
    h.backend = f.backend
    const store = useOfflineVideosStore()
    await store.hydrate()
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(f.backend.resume).toHaveBeenCalledWith('n-144'))
    expect(f.backend.resume).not.toHaveBeenCalledWith('x-144')
  })
})
