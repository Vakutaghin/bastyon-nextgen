// nativeFetch: JSON-API сервера чатов на Android идёт нативным HTTP мимо CORS
// WebView; медиа и двоичные тела — нет. Ответ собирается в Response с
// текстом, сбой сети — TypeError с причиной, abort — AbortError.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const cap = vi.hoisted(() => ({
  native: true,
  plugin: true,
  request: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    isPluginAvailable: (name: string) => name === 'CapacitorHttp' && cap.plugin,
  },
  CapacitorHttp: { request: cap.request },
}))

import { isNativeMatrixRequest, nativeFetch } from './request-native'

const HS = 'https://matrix.pocketnet.app'
const json = { 'Content-Type': 'application/json' }

describe('isNativeMatrixRequest', () => {
  beforeEach(() => {
    cap.native = true
    cap.plugin = true
  })

  it('JSON-API сервера чатов — нативно', () => {
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/v3/sync?timeout=30000`)).toBe(true)
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/versions`)).toBe(true)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/login`, {
        method: 'POST',
        body: '{}',
        headers: json,
      })
    ).toBe(true)
  })

  it('вне приложения, без плагина, медиа, двоичные тела и тело без Content-Type — нет', () => {
    expect(isNativeMatrixRequest(`${HS}/_matrix/media/v3/download/x/y`)).toBe(false)
    expect(isNativeMatrixRequest(`${HS}/_matrix/client/v1/media/download/x/y`)).toBe(false)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/user/u/account_data/x`, {
        method: 'PUT',
        body: new Blob(['x']),
      })
    ).toBe(false)
    expect(
      isNativeMatrixRequest(`${HS}/_matrix/client/v3/login`, { method: 'POST', body: '{}' })
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
  })

  it('передаёт метод, заголовки и тело; разобранный JSON отдаёт текстом', async () => {
    cap.request.mockResolvedValue({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data: { next_batch: 's1', rooms: {} },
      url: `${HS}/_matrix/client/v3/login`,
    })
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
        data: '{"type":"m.login.password"}',
      })
    )
  })

  it('ошибку сервера отдаёт как есть: код и тело', async () => {
    cap.request.mockResolvedValue({
      status: 502,
      headers: { 'Content-Type': 'text/html' },
      data: '<html>502 Bad Gateway</html>',
      url: HS,
    })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/sync`)
    expect(res.status).toBe(502)
    await expect(res.text()).resolves.toContain('502 Bad Gateway')
  })

  it('204 — без тела', async () => {
    cap.request.mockResolvedValue({ status: 204, headers: {}, data: '', url: HS })
    const res = await nativeFetch(`${HS}/_matrix/client/v3/x`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    await expect(res.text()).resolves.toBe('')
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

  it('abort не ждёт нативный запрос', async () => {
    cap.request.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()
    const p = nativeFetch(`${HS}/_matrix/client/v3/sync`, { signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
