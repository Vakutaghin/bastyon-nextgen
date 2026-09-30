// Информация о видео с PeerTube: id видео экранируется в пути (P1-9),
// 404 — сразу «нет видео», остальные сбои — три попытки с паузами 0,5 и 1 с,
// причина для интерфейса: таймаут, CORS/сеть в проде, ошибка сервера.
// Выведенная из работы нода — сначала её архив; нода, которая не ответила, —
// ещё и прокси Bastyon. Описание ролика запоминается на минуту.
// Субтитры — необязательны: любая ошибка даёт пустой список.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ appFetch: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ appFetch: mocks.appFetch }))
// Живую прокси-ноду выбирает node-selector пингом; здесь — первая по списку.
vi.mock('./node-selector', () => ({ orderedProxies: async <T>(list: T[]) => list }))

import {
  clearPeerTubeInfoCache,
  getPeerTubeCaptions,
  getPeerTubeVideoInfo,
  PeerTubeFetchError,
} from './peertube-api'

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: async () => body,
})

/** Описание, в котором есть что играть. */
const video = (uuid: string) => ({ uuid, name: 'Видео', files: [{ fileUrl: 'https://h/v.mp4' }] })

const PROXY_VIDEO = 'https://1.pocketnet.app:8899/peertube/video?url='

async function failure(promise: Promise<unknown>): Promise<PeerTubeFetchError> {
  return (await promise.catch((e: unknown) => e)) as PeerTubeFetchError
}

const calledUrls = (): string[] => mocks.appFetch.mock.calls.map((call) => String(call[0]))

describe('getPeerTubeVideoInfo', () => {
  beforeEach(() => {
    mocks.appFetch.mockReset()
    clearPeerTubeInfoCache()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('id видео экранируется: «../» и query не уводят запрос на другой эндпоинт', async () => {
    mocks.appFetch.mockResolvedValue(json({ uuid: 'u1', name: 'Видео' }))
    await expect(getPeerTubeVideoInfo('video.bastyon.com', '../users/me?x=1')).resolves.toEqual({
      uuid: 'u1',
      name: 'Видео',
      servedBy: 'video.bastyon.com',
    })
    const [url, init] = mocks.appFetch.mock.calls[0]!
    expect(url).toBe('/api/peertube/video.bastyon.com/api/v1/videos/..%2Fusers%2Fme%3Fx%3D1')
    expect(init).toMatchObject({ method: 'GET', redirect: 'follow' })
  })

  it('в собранном приложении — прямо на хост', async () => {
    vi.stubEnv('DEV', false)
    mocks.appFetch.mockResolvedValue(json({ uuid: 'u1' }))
    await getPeerTubeVideoInfo('video.bastyon.com', 'abc')
    expect(mocks.appFetch.mock.calls[0]![0]).toBe('https://video.bastyon.com/api/v1/videos/abc')
  })

  it('404 — «видео нет», без повторов и без прокси', async () => {
    mocks.appFetch.mockResolvedValue(json({}, 404))
    const error = await failure(getPeerTubeVideoInfo('h', 'gone'))
    expect(error).toBeInstanceOf(PeerTubeFetchError)
    expect(error.code).toBe('not-found')
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
  })

  it('ошибка сервера: три попытки с паузами 0,5 и 1 с, потом прокси, итог http-error', async () => {
    mocks.appFetch.mockResolvedValue(json({}, 503))
    const pending = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(499)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    const error = await pending
    expect(calledUrls()).toHaveLength(4)
    expect(calledUrls()[3]).toBe(`${PROXY_VIDEO}peertube%3A%2F%2Fh%2Fv`)
    expect(error.code).toBe('http-error')
    expect(error.message).toContain('503')
  })

  it('вторая попытка удалась — видео получено', async () => {
    mocks.appFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ uuid: 'u2' }))
    const pending = getPeerTubeVideoInfo('h', 'v')
    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toEqual({ uuid: 'u2', servedBy: 'h' })
  })

  it('нода молчит 10 с — второй попытки нет, прокси тоже молчит — итог «timeout»', async () => {
    mocks.appFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          )
        )
    )
    const pending = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calledUrls()).toHaveLength(2)
    expect(calledUrls()[1]).toContain(PROXY_VIDEO)
    await vi.advanceTimersByTimeAsync(10_000)
    expect((await pending).code).toBe('timeout')
  })

  it('TypeError в проде — «CORS или сеть», в dev через прокси — просто неизвестная ошибка', async () => {
    mocks.appFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const dev = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(1500)
    expect((await dev).code).toBe('unknown')

    vi.stubEnv('DEV', false)
    const prod = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(1500)
    expect((await prod).code).toBe('cors-or-network')
  })

  it('без хоста или id — ошибка до запроса', async () => {
    await expect(getPeerTubeVideoInfo('', 'v')).rejects.toThrow('Host and videoId are required')
    expect(mocks.appFetch).not.toHaveBeenCalled()
  })

  describe('нода из ссылки выведена из работы или не отвечает', () => {
    it('выведенная нода: ролик сразу из её архива, сама нода не нужна', async () => {
      mocks.appFetch.mockResolvedValue(json(video('a1')))
      const info = await getPeerTubeVideoInfo('peertube3501.pocketnet.app', 'a1')
      expect(info.servedBy).toBe('peertube.archive.pocketnet.app')
      expect(calledUrls()).toEqual([
        '/api/peertube/peertube.archive.pocketnet.app/api/v1/videos/a1',
      ])
    })

    it('600-я нода ушла не в общий архив, а на 601-ю', async () => {
      mocks.appFetch.mockResolvedValue(json(video('a2')))
      const info = await getPeerTubeVideoInfo('PEERTUBE600.pocketnet.app', 'a2')
      expect(info.servedBy).toBe('peertube601.pocketnet.app')
    })

    it('в архиве ролика нет — пробуем саму ноду', async () => {
      mocks.appFetch.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json(video('a3')))
      const info = await getPeerTubeVideoInfo('peertube33.pocketnet.app', 'a3')
      expect(info.servedBy).toBe('peertube33.pocketnet.app')
      expect(calledUrls()[1]).toBe('/api/peertube/peertube33.pocketnet.app/api/v1/videos/a3')
    })

    it('ноды нет в списке архивов — ролик находит прокси, нода берётся из его `from`', async () => {
      mocks.appFetch.mockImplementation(async (url: string) =>
        url.startsWith(PROXY_VIDEO)
          ? json({ result: 'success', data: { data: { ...video('p1'), from: 'Mirror.Example' } } })
          : Promise.reject(new TypeError('Failed to fetch'))
      )
      const pending = getPeerTubeVideoInfo('gone.example', 'p1')
      await vi.advanceTimersByTimeAsync(1500)
      const info = await pending
      expect(info.servedBy).toBe('mirror.example')
      expect(info).not.toHaveProperty('from')
      expect(calledUrls().slice(-1)[0]).toBe(`${PROXY_VIDEO}peertube%3A%2F%2Fgone.example%2Fp1`)
    })

    it('прокси вместо ролика вернул ошибку PeerTube — остаётся ошибка ноды', async () => {
      vi.stubEnv('DEV', false)
      mocks.appFetch.mockImplementation(async (url: string) =>
        url.startsWith(PROXY_VIDEO)
          ? json({ result: 'success', data: { data: { status: 400, title: 'Bad Request' } } })
          : Promise.reject(new TypeError('Failed to fetch'))
      )
      const pending = failure(getPeerTubeVideoInfo('gone.example', 'p2'))
      await vi.advanceTimersByTimeAsync(1500)
      expect((await pending).code).toBe('cors-or-network')
    })

    it('`from` не похож на имя хоста — относительные пути считаем от ноды из ссылки', async () => {
      mocks.appFetch.mockImplementation(async (url: string) =>
        url.startsWith(PROXY_VIDEO)
          ? json({ result: 'success', data: { data: { ...video('p3'), from: 'evil.com/x?' } } })
          : json({}, 500)
      )
      const pending = getPeerTubeVideoInfo('gone.example', 'p3')
      await vi.advanceTimersByTimeAsync(1500)
      expect((await pending).servedBy).toBe('gone.example')
    })
  })

  describe('память', () => {
    it('превью, плеер и субтитры одного ролика — один запрос', async () => {
      mocks.appFetch.mockResolvedValue(json(video('m1')))
      await Promise.all([getPeerTubeVideoInfo('h', 'm1'), getPeerTubeVideoInfo('h', 'm1')])
      await getPeerTubeVideoInfo('H', 'm1')
      expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    })

    it('через минуту описание запрашивается заново', async () => {
      mocks.appFetch.mockResolvedValue(json(video('m2')))
      await getPeerTubeVideoInfo('h', 'm2')
      await vi.advanceTimersByTimeAsync(60_001)
      await getPeerTubeVideoInfo('h', 'm2')
      expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    })

    it('ролик в обработке (ни HLS, ни файлов) и ошибка не запоминаются', async () => {
      mocks.appFetch.mockResolvedValue(json({ uuid: 'm3', streamingPlaylists: [], files: [] }))
      await getPeerTubeVideoInfo('h', 'm3')
      await getPeerTubeVideoInfo('h', 'm3')
      expect(mocks.appFetch).toHaveBeenCalledTimes(2)

      mocks.appFetch.mockReset()
      mocks.appFetch.mockResolvedValue(json({}, 404))
      await failure(getPeerTubeVideoInfo('h', 'm4'))
      await failure(getPeerTubeVideoInfo('h', 'm4'))
      expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    })
  })
})

describe('getPeerTubeCaptions', () => {
  beforeEach(() => {
    mocks.appFetch.mockReset()
    clearPeerTubeInfoCache()
  })
  afterEach(() => vi.unstubAllEnvs())

  /** Нода отдаёт описание ролика и список субтитров. */
  const node = (captions: () => unknown) =>
    mocks.appFetch.mockImplementation(async (url: string) =>
      url.endsWith('/captions') ? captions() : json(video('v'))
    )

  it('дорожки: язык, подпись и адрес VTT; без языка или адреса — отбрасываются', async () => {
    node(() =>
      json({
        data: [
          {
            language: { id: 'ru', label: 'Русский' },
            captionPath: '/lazy-static/video-captions/a.vtt',
          },
          { language: { id: 'en' }, fileUrl: 'https://cdn.example/b.vtt' },
          { language: {}, captionPath: '/c.vtt' },
          { language: { id: 'de', label: 'Deutsch' } },
        ],
      })
    )
    await expect(getPeerTubeCaptions('video.bastyon.com', 'v 1')).resolves.toEqual([
      {
        language: 'ru',
        label: 'Русский',
        url: '/api/peertube/video.bastyon.com/lazy-static/video-captions/a.vtt',
      },
      { language: 'en', label: 'en', url: 'https://cdn.example/b.vtt' },
    ])
    expect(calledUrls()).toContain('/api/peertube/video.bastyon.com/api/v1/videos/v%201/captions')
  })

  it('в собранном приложении относительный путь склеивается с хостом', async () => {
    vi.stubEnv('DEV', false)
    node(() => json({ data: [{ language: { id: 'ru' }, captionPath: 'static/a.vtt' }] }))
    const [track] = await getPeerTubeCaptions('video.bastyon.com', 'v')
    expect(track?.url).toBe('https://video.bastyon.com/static/a.vtt')
  })

  it('субтитры выведенной ноды — из архива, где лежит ролик', async () => {
    vi.stubEnv('DEV', false)
    node(() => json({ data: [{ language: { id: 'ru' }, captionPath: '/lazy-static/a.vtt' }] }))
    const [track] = await getPeerTubeCaptions('peertube3501.pocketnet.app', 'v')
    expect(track?.url).toBe('https://peertube.archive.pocketnet.app/lazy-static/a.vtt')
  })

  it('нет субтитров, ошибка сервера или сети — пустой список', async () => {
    node(() => json({}, 500))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    node(() => Promise.reject(new TypeError('offline')))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    node(() => json({ data: 'not-an-array' }))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    await expect(getPeerTubeCaptions('', 'v')).resolves.toEqual([])
  })
})
