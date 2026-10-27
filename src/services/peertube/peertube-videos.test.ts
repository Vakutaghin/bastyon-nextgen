import { describe, it, expect, vi } from 'vitest'
import {
  getMyAccountVideos,
  deleteInstanceVideo,
  renameInstanceVideo,
  setInstanceVideoCover,
  getInstanceVideoCover,
  checkTranscodingReady,
  findPostedVideos,
  getPostedVideosPage,
  getVideosInfo,
  removeVideoByPointer,
  type RemoveVideoDeps,
} from './peertube-videos'
import type { InstanceFetch } from './peertube-instance'
import type { KeyPair } from '@/blockchain/types/keys'

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('getMyAccountVideos', () => {
  it('парсит {total,data}, шлёт Bearer и пагинацию', async () => {
    const fetchInstance = vi.fn(async () =>
      jsonRes({ total: 2, data: [{ id: 1, uuid: 'a', name: 'x' }] })
    ) as unknown as InstanceFetch & { mock: { calls: unknown[][] } }

    const r = await getMyAccountVideos({
      host: 'h',
      accessToken: 'AT',
      start: 15,
      count: 5,
      fetchInstance,
    })
    expect(r.total).toBe(2)
    expect(r.data).toHaveLength(1)

    const call = fetchInstance.mock.calls[0]
    expect(call?.[0]).toBe('api/v1/users/me/videos?start=15&count=5')
    const headers = (call?.[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer AT')
  })

  it('не-ok → ошибка с кодом; отсутствующие поля → пустой список', async () => {
    await expect(
      getMyAccountVideos({
        host: 'h',
        accessToken: 'AT',
        fetchInstance: (async () => jsonRes({}, 500)) as InstanceFetch,
      })
    ).rejects.toThrow('peertube_my_videos_500')

    const r = await getMyAccountVideos({
      host: 'h',
      accessToken: 'AT',
      fetchInstance: (async () => jsonRes({})) as InstanceFetch,
    })
    expect(r).toEqual({ total: 0, data: [] })
  })
})

describe('deleteInstanceVideo', () => {
  it('204 → deleted', async () => {
    const r = await deleteInstanceVideo({
      host: 'h',
      id: 42,
      accessToken: 'AT',
      fetchInstance: (async () => new Response(null, { status: 204 })) as InstanceFetch,
    })
    expect(r).toEqual({ deleted: true, alreadyGone: false })
  })

  it('404 → идемпотентно (alreadyGone)', async () => {
    const r = await deleteInstanceVideo({
      host: 'h',
      id: 'abc',
      accessToken: 'AT',
      fetchInstance: (async () => new Response(null, { status: 404 })) as InstanceFetch,
    })
    expect(r).toEqual({ deleted: false, alreadyGone: true })
  })

  it('прочая ошибка → throw', async () => {
    await expect(
      deleteInstanceVideo({
        host: 'h',
        id: 1,
        accessToken: 'AT',
        fetchInstance: (async () => new Response(null, { status: 403 })) as InstanceFetch,
      })
    ).rejects.toThrow('peertube_delete_video_403')
  })

  it('энкодит id в path', async () => {
    const fetchInstance = vi.fn(
      async () => new Response(null, { status: 204 })
    ) as unknown as InstanceFetch & {
      mock: { calls: unknown[][] }
    }
    await deleteInstanceVideo({ host: 'h', id: 'a/b', accessToken: 'AT', fetchInstance })
    expect(fetchInstance.mock.calls[0]?.[0]).toBe('api/v1/videos/a%2Fb')
  })
})

describe('setInstanceVideoCover', () => {
  it('PUT videos/:id: одна картинка и в thumbnailfile, и в previewfile', async () => {
    const fetchInstance = vi.fn(async () => new Response(null, { status: 204 }))
    const image = new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' })
    await setInstanceVideoCover({
      host: 'h',
      id: 'uuid1',
      image,
      accessToken: 'AT',
      fetchInstance: fetchInstance as unknown as InstanceFetch,
    })
    const [path, init] = fetchInstance.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('api/v1/videos/uuid1')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer AT')
    const body = init.body as FormData
    expect(body.get('thumbnailfile')).toBeInstanceOf(File)
    expect((body.get('previewfile') as File).name).toBe('cover.jpg')
  })

  it('сервер отказал — ошибка с кодом', async () => {
    const fetchInstance = vi.fn(async () => new Response(null, { status: 400 }))
    await expect(
      setInstanceVideoCover({
        host: 'h',
        id: 'u',
        image: new File(['x'], 'cover.jpg', { type: 'image/jpeg' }),
        accessToken: 'AT',
        fetchInstance: fetchInstance as unknown as InstanceFetch,
      })
    ).rejects.toThrow('peertube_video_cover_400')
  })
})

describe('getInstanceVideoCover', () => {
  it('превью ролика с его сервера, без входа', async () => {
    const fetchInstance = vi.fn(async () =>
      jsonRes({
        previewPath: '/lazy-static/previews/p.jpg',
        thumbnailPath: '/static/thumbnails/t.jpg',
      })
    )
    const url = await getInstanceVideoCover({
      host: 'h',
      id: 'uuid1',
      fetchInstance: fetchInstance as unknown as InstanceFetch,
    })
    expect(url).toBe('https://h/lazy-static/previews/p.jpg')
    const [path, init] = fetchInstance.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('api/v1/videos/uuid1')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('нет превью — миниатюра; сервер не ответил — null', async () => {
    const thumbOnly = vi.fn(async () => jsonRes({ thumbnailPath: '/static/thumbnails/t.jpg' }))
    await expect(
      getInstanceVideoCover({
        host: 'h',
        id: 'u',
        fetchInstance: thumbOnly as unknown as InstanceFetch,
      })
    ).resolves.toBe('https://h/static/thumbnails/t.jpg')
    const failing = vi.fn(async () => new Response(null, { status: 404 }))
    await expect(
      getInstanceVideoCover({
        host: 'h',
        id: 'u',
        fetchInstance: failing as unknown as InstanceFetch,
      })
    ).resolves.toBeNull()
  })
})

describe('renameInstanceVideo', () => {
  it('PUT videos/:id с Bearer и именем в multipart', async () => {
    const fetchInstance = vi.fn(async () => new Response(null, { status: 204 }))
    await renameInstanceVideo({
      host: 'h',
      id: 'uu id',
      name: 'Отпуск в Сочи',
      accessToken: 'AT',
      fetchInstance: fetchInstance as unknown as InstanceFetch,
    })
    const [path, init] = fetchInstance.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('api/v1/videos/uu%20id')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer AT')
    expect((init.body as FormData).get('name')).toBe('Отпуск в Сочи')
  })

  it('ошибка сервера → throw с кодом', async () => {
    const fetchInstance = vi.fn(async () => new Response(null, { status: 403 }))
    await expect(
      renameInstanceVideo({
        host: 'h',
        id: 1,
        name: 'x',
        accessToken: 'AT',
        fetchInstance: fetchInstance as unknown as InstanceFetch,
      })
    ).rejects.toThrow('peertube_rename_video_403')
  })
})

describe('checkTranscodingReady', () => {
  it('state 1 → ready; state 2/3 → not ready; отсутствие → false', async () => {
    const fetchNode = vi.fn(async () => ({
      'peertube://h/ready': { state: { id: 1 } },
      'peertube://h/transcoding': { state: { id: 2 } },
      'peertube://h/importing': { state: { id: 3 } },
    }))
    const urls = [
      'peertube://h/ready',
      'peertube://h/transcoding',
      'peertube://h/importing',
      'peertube://h/missing',
    ]
    const r = await checkTranscodingReady({ urls, fetchNode })
    expect(r).toEqual({
      'peertube://h/ready': true,
      'peertube://h/transcoding': false,
      'peertube://h/importing': false,
      'peertube://h/missing': false,
    })
    // шлёт update:true
    expect(fetchNode).toHaveBeenCalledWith('peertube/videos', { urls, update: true })
  })

  it('пустой список → пустой map, без сетевого вызова', async () => {
    const fetchNode = vi.fn()
    const r = await checkTranscodingReady({ urls: [], fetchNode })
    expect(r).toEqual({})
    expect(fetchNode).not.toHaveBeenCalled()
  })
})

describe('findPostedVideos', () => {
  it('url → посты с ним; Barteron — «в посте», но открывать нечего', async () => {
    const searchLinks = vi.fn(async () => [
      {
        u: encodeURIComponent('peertube://h/posted1'),
        type: 'video',
        txid: 't1',
        c: 'Море',
        time: 10,
      },
      { u: 'peertube://h/posted1', type: 'video', txid: 't2', c: 'Море снова', time: 20 },
      { u: 'peertube://h/posted1', type: 'video', txid: 't2', c: 'Море снова', time: 20 },
      { u: 'peertube://h/offer', type: 'brtoffer', txid: 't3' },
      { u: 'peertube://h/gone', type: 'video', txid: 't4', deleted: true },
      {}, // без u — пропускаем
    ])
    const urls = [
      'peertube://h/posted1',
      'peertube://h/offer',
      'peertube://h/gone',
      'peertube://h/draft',
    ]
    const posted = await findPostedVideos({ urls, searchLinks })

    expect(posted.get('peertube://h/posted1')).toEqual([
      { txid: 't1', caption: 'Море', time: 10_000 },
      { txid: 't2', caption: 'Море снова', time: 20_000 },
    ])
    expect(posted.get('peertube://h/offer')).toEqual([])
    expect(posted.has('peertube://h/gone')).toBe(false)
    expect(posted.has('peertube://h/draft')).toBe(false)
    // У одного видео может быть несколько постов — берём с запасом.
    expect(searchLinks).toHaveBeenCalledWith(urls, ['video', 'brtoffer', 'brtofferpaid'], 0, 20)
  })

  it('пустой список → пусто без вызова', async () => {
    const searchLinks = vi.fn()
    const posted = await findPostedVideos({ urls: [], searchLinks })
    expect(posted.size).toBe(0)
    expect(searchLinks).not.toHaveBeenCalled()
  })
})

describe('getPostedVideosPage', () => {
  it('только видео PeerTube из живых постов; полная страница — есть следующая', async () => {
    const profileFeed = vi.fn(async () => [
      { txid: 'a', type: 'video', u: 'peertube://h1/u1', c: 'Первое', time: 100 },
      { txid: 'b', type: 'video', u: 'https://youtu.be/x', c: 'Ютуб' },
      { txid: 'c', type: 'video', u: 'peertube://h2/u2', deleted: true },
    ])
    const page = await getPostedVideosPage({ address: 'PMe', count: 3, profileFeed })
    expect(profileFeed).toHaveBeenCalledWith('PMe', '', 3)
    expect(page.videos).toEqual([
      { pointer: 'peertube://h1/u1', post: { txid: 'a', caption: 'Первое', time: 100_000 } },
    ])
    expect(page.next).toBe('c')
  })

  it('неполная страница — постов больше нет', async () => {
    const profileFeed = vi.fn(async () => [{ txid: 'a', type: 'video', u: 'peertube://h1/u1' }])
    const page = await getPostedVideosPage({ address: 'PMe', after: 'z', count: 50, profileFeed })
    expect(profileFeed).toHaveBeenCalledWith('PMe', 'z', 50)
    expect(page.next).toBeNull()
  })
})

describe('getVideosInfo', () => {
  it('один запрос к ноде; не ответившие серверы (errors) — без сведений', async () => {
    const fetchNode = vi.fn(async () => ({
      'peertube://h/u1': { id: 5, name: 'Море', state: { id: 1 } },
      errors: ['peertube://dead/u2'],
    }))
    const urls = ['peertube://h/u1', 'peertube://dead/u2']
    const info = await getVideosInfo({ urls, fetchNode })
    expect(fetchNode).toHaveBeenCalledWith('peertube/videos', { urls })
    expect(info.get('peertube://h/u1')).toMatchObject({ id: 5, name: 'Море' })
    expect(info.has('peertube://dead/u2')).toBe(false)
  })
})

describe('removeVideoByPointer', () => {
  const KEYPAIR = {} as unknown as KeyPair
  const TOKEN = {
    access_token: 'AT',
    refresh_token: 'R',
    expires_in: 9999,
    refresh_token_expires_in: 9999,
    isNewUser: false,
  }

  const buildDeps = (over: Partial<RemoveVideoDeps> = {}): RemoveVideoDeps => ({
    parse: (url: string) =>
      url.startsWith('peertube://') ? { host: 'h.app', videoId: 'VID', type: undefined } : null,
    buildSignature: vi.fn(() => ({
      nonce: 'n',
      signature: 's',
      pubkey: 'p',
      address: 'A',
      v: 1 as const,
    })),
    ensureToken: vi.fn(async () => TOKEN),
    del: vi.fn(async () => ({ deleted: true, alreadyGone: false })),
    ...over,
  })

  it('parse → авторизация на host → DELETE videoId с токеном', async () => {
    const deps = buildDeps()
    const r = await removeVideoByPointer({
      pointer: 'peertube://h.app/VID',
      keyPair: KEYPAIR,
      address: 'ADDR',
      deps,
    })
    expect(r).toEqual({ deleted: true, alreadyGone: false })
    expect(deps.ensureToken).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'h.app', address: 'ADDR' })
    )
    expect(deps.del).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'h.app', id: 'VID', accessToken: 'AT' })
    )
  })

  it('невалидный указатель → бросает, без авторизации/удаления', async () => {
    const deps = buildDeps()
    await expect(
      removeVideoByPointer({
        pointer: 'https://not-peertube',
        keyPair: KEYPAIR,
        address: 'ADDR',
        deps,
      })
    ).rejects.toThrow('peertube_pointer_invalid')
    expect(deps.ensureToken).not.toHaveBeenCalled()
    expect(deps.del).not.toHaveBeenCalled()
  })
})
