import { describe, it, expect, vi } from 'vitest'
import {
  getMyAccountVideos,
  deleteInstanceVideo,
  checkTranscodingReady,
  findPostedVideos,
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
  it('декодирует post.u в Set опубликованных; тип-фильтр корректен', async () => {
    const searchLinks = vi.fn(async () => [
      { u: encodeURIComponent('peertube://h/posted1') },
      { u: 'peertube://h/posted2' },
      {}, // без u — пропускаем
    ])
    const urls = ['peertube://h/posted1', 'peertube://h/posted2', 'peertube://h/draft']
    const posted = await findPostedVideos({ urls, searchLinks })

    expect(posted.has('peertube://h/posted1')).toBe(true)
    expect(posted.has('peertube://h/posted2')).toBe(true)
    expect(posted.has('peertube://h/draft')).toBe(false)

    expect(searchLinks).toHaveBeenCalledWith(urls, ['video', 'brtoffer', 'brtofferpaid'], 0, 3)
  })

  it('пустой список → пустой Set без вызова', async () => {
    const searchLinks = vi.fn()
    const posted = await findPostedVideos({ urls: [], searchLinks })
    expect(posted.size).toBe(0)
    expect(searchLinks).not.toHaveBeenCalled()
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
