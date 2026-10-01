// «Мои видео» на видеосерверах: по серверу на рой, на каждом свой список;
// что уже в постах — по ноде; обработка у сервера ещё идёт — видно; сервер
// не ответил — остальные всё равно показаны; удалить — с сервера и из списка.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { privateKey: 'k' } as unknown, getUserAddress: 'PMe' as string | null },
  hosts: vi.fn(),
  token: vi.fn(async ({ host }: { host: string }) => ({ access_token: `T-${host}` })),
  list: vi.fn(),
  posted: vi.fn(),
  del: vi.fn(),
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
}))

import { useServerVideos } from './use-server-videos'

describe('useServerVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.getKeyPair = { privateKey: 'k' }
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
    mocks.posted.mockResolvedValue(new Set(['peertube://a.host/u1']))
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
})
