// Информация о видео с PeerTube: id видео экранируется в пути (P1-9),
// 404 — сразу «нет видео», остальные сбои — три попытки с паузами 0,5 и 1 с,
// причина для интерфейса: таймаут, CORS/сеть в проде, ошибка сервера.
// Субтитры — необязательны: любая ошибка даёт пустой список.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ appFetch: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ appFetch: mocks.appFetch }))

import { getPeerTubeCaptions, getPeerTubeVideoInfo, PeerTubeFetchError } from './peertube-api'

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: async () => body,
})

async function failure(promise: Promise<unknown>): Promise<PeerTubeFetchError> {
  return (await promise.catch((e: unknown) => e)) as PeerTubeFetchError
}

describe('getPeerTubeVideoInfo', () => {
  beforeEach(() => {
    mocks.appFetch.mockReset()
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

  it('404 — «видео нет», без повторов', async () => {
    mocks.appFetch.mockResolvedValue(json({}, 404))
    const error = await failure(getPeerTubeVideoInfo('h', 'gone'))
    expect(error).toBeInstanceOf(PeerTubeFetchError)
    expect(error.code).toBe('not-found')
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
  })

  it('ошибка сервера: три попытки с паузами 0,5 и 1 с, потом http-error', async () => {
    mocks.appFetch.mockResolvedValue(json({}, 503))
    const pending = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(499)
    expect(mocks.appFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.appFetch).toHaveBeenCalledTimes(3)
    const error = await pending
    expect(error.code).toBe('http-error')
    expect(error.message).toContain('503')
  })

  it('вторая попытка удалась — видео получено', async () => {
    mocks.appFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ uuid: 'u2' }))
    const pending = getPeerTubeVideoInfo('h', 'v')
    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toEqual({ uuid: 'u2' })
  })

  it('каждая попытка ограничена 10 с — итог «timeout»', async () => {
    mocks.appFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          )
        )
    )
    const pending = failure(getPeerTubeVideoInfo('h', 'v'))
    await vi.advanceTimersByTimeAsync(10_000 + 500 + 10_000 + 1000 + 10_000)
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
})

describe('getPeerTubeCaptions', () => {
  beforeEach(() => mocks.appFetch.mockReset())
  afterEach(() => vi.unstubAllEnvs())

  it('дорожки: язык, подпись и адрес VTT; без языка или адреса — отбрасываются', async () => {
    mocks.appFetch.mockResolvedValue(
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
    expect(mocks.appFetch.mock.calls[0]![0]).toBe(
      '/api/peertube/video.bastyon.com/api/v1/videos/v%201/captions'
    )
  })

  it('в собранном приложении относительный путь склеивается с хостом', async () => {
    vi.stubEnv('DEV', false)
    mocks.appFetch.mockResolvedValue(
      json({ data: [{ language: { id: 'ru' }, captionPath: 'static/a.vtt' }] })
    )
    const [track] = await getPeerTubeCaptions('video.bastyon.com', 'v')
    expect(track?.url).toBe('https://video.bastyon.com/static/a.vtt')
  })

  it('нет субтитров, ошибка сервера или сети — пустой список', async () => {
    mocks.appFetch.mockResolvedValueOnce(json({}, 500))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    mocks.appFetch.mockRejectedValueOnce(new TypeError('offline'))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    mocks.appFetch.mockResolvedValueOnce(json({ data: 'not-an-array' }))
    await expect(getPeerTubeCaptions('h', 'v')).resolves.toEqual([])
    await expect(getPeerTubeCaptions('', 'v')).resolves.toEqual([])
  })
})
