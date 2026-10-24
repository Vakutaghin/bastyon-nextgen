// nativeFetch: JSON-API сервера чатов на Android идёт нативным HTTP мимо CORS
// WebView; медиа и двоичные тела — нет. Тело ответа плагин кладёт в файл, его
// читает WebView, файл после этого удаляется. Сбой сети — TypeError с
// причиной, abort — AbortError и отмена запроса в плагине.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cap = vi.hoisted(() => ({
  native: true,
  plugin: true,
  request: vi.fn(),
  cancel: vi.fn(async () => {}),
  release: vi.fn(async () => {}),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    isPluginAvailable: (name: string) => name === 'MatrixHttp' && cap.plugin,
    convertFileSrc: (path: string) => `https://localhost/_capacitor_file_${path}`,
  },
  registerPlugin: () => ({ request: cap.request, cancel: cap.cancel, release: cap.release }),
}))

import { isNativeMatrixRequest, nativeFetch } from './request-native'

const HS = 'https://matrix.pocketnet.app'
const json = { 'Content-Type': 'application/json' }
const FILE = '/data/user/0/com.bastyon.app/cache/matrix-http/a.body'

/** Файлы кэша, которые «отдаёт» WebView. */
let files: Record<string, string>

beforeEach(() => {
  files = {}
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.replace('https://localhost/_capacitor_file_', '')
      if (!(path in files)) throw new TypeError('Failed to fetch')
      return new Response(files[path])
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isNativeMatrixRequest', () => {
  beforeEach(() => {
    cap.native = true
    cap.plugin = true
  })

  it('JSON-API сервера чатов — нативно, в том числе тело без Content-Type', () => {
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/v3/sync?timeout=30000`)).toBe(true)
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/versions`)).toBe(true)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/login`, {
        method: 'POST',
        body: '{}',
        headers: json,
      })
    ).toBe(true)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/login`, { method: 'POST', body: '{}' })
    ).toBe(true)
  })

  it('вне приложения, без плагина, медиа, двоичные тела и PATCH — нет', () => {
    expect(isNativeMatrixRequest(`${HS}/_matrix/media/v3/download/x/y`)).toBe(false)
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/v1/media/download/x/y`)).toBe(false)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/user/u/account_data/x`, {
        method: 'PUT',
        body: new Blob(['x']),
      })
    ).toBe(false)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/x`, { method: 'PATCH', body: '{}' })
    ).toBe(false)
    expect(isNativeMatrixRequest(new Request(`${HS}/_matrix/client/versions`))).toBe(false)
    expect(isNativeMatrixRequest('/_matrix/client/versions')).toBe(false)
    cap.plugin = false
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/versions`)).toBe(false)
    cap.plugin = true
    cap.native = false
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/versions`)).toBe(false)
  })
})

describe('nativeFetch', () => {
  beforeEach(() => {
    cap.request.mockReset()
    cap.cancel.mockClear()
    cap.release.mockClear()
  })

  it('передаёт метод, заголовки и тело; тело ответа читает из файла и удаляет файл', async () => {
    files[FILE] = '{"next_batch":"s1","rooms":{}}'
    cap.request.mockResolvedValue({ status: 200, headers: json, path: FILE })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/login`, {
      method: 'post',
      headers: { ...json, Authorization: 'Bearer t' },
      body: '{"type":"m.login.password"}',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    await expect(res.json()).resolves.toEqual({ next_batch: 's1', rooms: {} })
    expect(cap.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${HS}/_matrix/client/v3/login`,
        method: 'POST',
        headers: { ...json, Authorization: 'Bearer t' },
        body: '{"type":"m.login.password"}',
      })
    )
    expect(cap.release).toHaveBeenCalledWith({ path: FILE })
  })

  it('ответ на десятки мегабайт приходит целиком', async () => {
    const big = JSON.stringify({ rooms: { join: { x: 'я'.repeat(5_000_000) } } })
    files[FILE] = big
    cap.request.mockResolvedValue({ status: 200, headers: json, path: FILE })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/sync`)
    expect((await res.text()).length).toBe(big.length)
  })

  it('ошибку сервера отдаёт как есть: код и тело', async () => {
    files[FILE] = '<html>502 Bad Gateway</html>'
    cap.request.mockResolvedValue({
      status: 502,
      headers: { 'Content-Type': 'text/html' },
      path: FILE,
    })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/sync`)
    expect(res.status).toBe(502)
    await expect(res.text()).resolves.toContain('502 Bad Gateway')
  })

  it('204 — без тела', async () => {
    cap.request.mockResolvedValue({ status: 204, headers: {}, path: '' })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/x`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    await expect(res.text()).resolves.toBe('')
    expect(cap.release).not.toHaveBeenCalled()
  })

  it('сбой сети — TypeError с кодом и причиной', async () => {
    cap.request.mockRejectedValue(
      Object.assign(new Error('Unable to resolve host "matrix.pocketnet.app"'), {
        code: 'UnknownHostException',
      })
    )
    const err = await nativeFetch(`${HS}/_matrix/client/versions`).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TypeError)
    expect((err as Error).message).toBe(
      'UnknownHostException: Unable to resolve host "matrix.pocketnet.app"'
    )
  })

  it('нехватка памяти в плагине — тоже ошибка, а не вечное ожидание', async () => {
    cap.request.mockRejectedValue(
      Object.assign(new Error('Failed to allocate'), { code: 'OutOfMemoryError' })
    )
    await expect(nativeFetch(`${HS}/_matrix/client/v3/sync`)).rejects.toThrow(
      'OutOfMemoryError: Failed to allocate'
    )
  })

  it('abort не ждёт нативный запрос, обрывает его, а поздний ответ удаляет', async () => {
    let answer: (r: unknown) => void = () => {}
    cap.request.mockReturnValue(new Promise((r) => (answer = r)))
    const controller = new AbortController()
    const p = nativeFetch(`${HS}/_matrix/client/v3/sync`, { signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    const { id } = cap.request.mock.calls[0]![0] as { id: string }
    expect(cap.cancel).toHaveBeenCalledWith({ id })

    answer({ status: 200, headers: {}, path: FILE })
    await vi.waitFor(() => expect(cap.release).toHaveBeenCalledWith({ path: FILE }))
  })
})
