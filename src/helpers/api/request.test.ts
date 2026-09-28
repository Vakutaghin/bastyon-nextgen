// Запросы к нодам: URL и тело RPC, разбор ответа (ошибка в JSON при 200 и
// при 500, httpStatus на ошибке для failover — P2-3, «аккаунт не найден» у
// user.get), таймаут вместо зависания, бродкаст транзакции без перебора нод
// (V1), HTTP с подписью и 401, и типизированные обёртки rpcCall*.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appFetch: vi.fn(),
  orderedProxies: vi.fn(),
  signRpc: vi.fn(),
  signHttp: vi.fn(),
}))
vi.mock('./fetch-strategies', () => ({
  appFetch: mocks.appFetch,
  matrixFetch: vi.fn(),
  getTauriFetch: vi.fn(),
}))
vi.mock('./node-selector', () => ({
  orderedProxies: mocks.orderedProxies,
  markProxyAlive: vi.fn(),
  markProxyDead: vi.fn(),
}))
vi.mock('./request-signing', () => ({
  signRpcParamsIfNeeded: mocks.signRpc,
  signHttpDataIfNeeded: mocks.signHttp,
}))

import {
  fetchHttp,
  getByPRC,
  getByPRCWithAuth,
  rpcCall,
  rpcCallArray,
  rpcCallWithAuth,
} from './request'

const NODE = { host: 'n1.pocketnet.app', port: 8899 }
const NODE2 = { host: 'n2.pocketnet.app', port: 8899 }

function response(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? '',
    json: async () => {
      if (body instanceof Error) throw body
      return body
    },
  }
}

describe('request', () => {
  beforeEach(() => {
    mocks.appFetch.mockReset()
    mocks.orderedProxies.mockReset().mockResolvedValue([NODE, NODE2])
    mocks.signRpc.mockReset().mockImplementation(async (p: object) => ({ ...p, signature: 'sig' }))
    mocks.signHttp.mockReset().mockImplementation(async (d: object) => ({ ...d, signature: 'sig' }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('getByPRC', () => {
    it('POST на живую ноду по пути метода, параметры — телом', async () => {
      mocks.appFetch.mockResolvedValue(response({ result: 'success', data: [1] }))
      const params = { method: 'getuserprofile', parameters: [['PMe']] }
      await expect(getByPRC(params)).resolves.toEqual({ result: 'success', data: [1] })

      const [url, init] = mocks.appFetch.mock.calls[0]!
      expect(url).toMatch(/^https:\/\/n1\.pocketnet\.app:8899\//)
      expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(params) })
      expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('ошибка в теле при 200 — пробрасывается как есть', async () => {
      const nodeError = { code: -26, message: 'bad-txns-inputs-spent' }
      mocks.appFetch.mockResolvedValue(response({ result: 'error', error: nodeError }))
      await expect(getByPRC({ method: 'm', parameters: [] }, NODE)).rejects.toBe(nodeError)
    })

    it('ошибка при 500 несёт httpStatus — по нему работает failover на таймаутах', async () => {
      mocks.appFetch.mockResolvedValue(
        response({ error: { code: 408, message: 'sql request timeout' } }, { status: 500 })
      )
      const error = (await getByPRC({ method: 'm', parameters: [] }, NODE).catch(
        (e: unknown) => e
      )) as { httpStatus?: number; code?: number }
      expect(error).toMatchObject({ code: 408, httpStatus: 500 })
    })

    it('HTTP 500 с timeout на первой ноде — вторая всё-таки спрошена', async () => {
      mocks.appFetch
        .mockResolvedValueOnce(
          response({ error: { code: 408, message: 'sql request timeout' } }, { status: 500 })
        )
        .mockResolvedValueOnce(response({ result: 'success', data: 'ok' }))
      await expect(getByPRC({ method: 'm', parameters: [] })).resolves.toEqual({
        result: 'success',
        data: 'ok',
      })
      expect(mocks.appFetch.mock.calls[1]![0]).toContain('n2.pocketnet.app')
    })

    it('500 без JSON — ошибка со статусом; 200 без JSON — «Invalid JSON»', async () => {
      mocks.appFetch.mockResolvedValueOnce(
        response(new SyntaxError('bad'), { status: 502, statusText: 'Bad Gateway' })
      )
      await expect(getByPRC({ method: 'm', parameters: [] }, NODE)).rejects.toThrow(
        'RPC request failed: 502 Bad Gateway'
      )
      mocks.appFetch.mockResolvedValueOnce(response(new SyntaxError('bad')))
      await expect(getByPRC({ method: 'm', parameters: [] }, NODE)).rejects.toThrow(
        'Invalid JSON response'
      )
    })

    it('user.get с 500 — «аккаунт не найден», а не ошибка', async () => {
      mocks.appFetch.mockResolvedValue(response({ message: 'not found' }, { status: 500 }))
      await expect(getByPRC({ method: 'user.get', parameters: ['PNew'] }, NODE)).resolves.toEqual({
        data: null,
      })
    })

    it('нода не отвечает — таймаут, а не зависание', async () => {
      vi.useFakeTimers()
      mocks.appFetch.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_, reject) =>
            init.signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            )
          )
      )
      const pending = getByPRC({ method: 'm', parameters: [], options: { timeout: 5000 } }, NODE)
      const assertion = expect(pending).rejects.toThrow('RPC request timeout after 5000ms')
      await vi.advanceTimersByTimeAsync(5000)
      await assertion
    })

    it('бродкаст (noFailover): одна нода, при сбое та же транзакция не уходит на вторую (V1)', async () => {
      mocks.appFetch.mockRejectedValue(new Error('ECONNRESET'))
      await expect(
        getByPRC({
          method: 'sendrawtransactionwithmessage',
          parameters: ['hex'],
          options: { noFailover: true },
        })
      ).rejects.toThrow('ECONNRESET')
      expect(mocks.appFetch).toHaveBeenCalledTimes(1)

      mocks.orderedProxies.mockResolvedValue([])
      await expect(
        getByPRC({ method: 'm', parameters: [], options: { noFailover: true } })
      ).rejects.toThrow('No RPC servers available')
    })

    it('getByPRCWithAuth подписывает параметры перед отправкой', async () => {
      mocks.appFetch.mockResolvedValue(response({ result: 'success' }))
      await getByPRCWithAuth({ method: 'getuserstate', parameters: ['PMe'] }, NODE)
      expect(JSON.parse(mocks.appFetch.mock.calls[0]![1].body)).toMatchObject({ signature: 'sig' })
    })
  })

  describe('rpcCall*', () => {
    it('снимает конверт {result, data}; ошибка и пустой ответ — исключения', async () => {
      mocks.appFetch.mockResolvedValueOnce(response({ result: 'success', data: { name: 'x' } }))
      await expect(rpcCall({ method: 'm', parameters: [] }, NODE)).resolves.toEqual({ name: 'x' })

      mocks.appFetch.mockResolvedValueOnce(response({ result: 'error' }))
      await expect(rpcCall({ method: 'm', parameters: [] }, NODE)).rejects.toThrow('RPC error')

      mocks.appFetch.mockResolvedValueOnce(response({ result: 'success', data: null }))
      await expect(rpcCallWithAuth({ method: 'm', parameters: [] }, NODE)).rejects.toThrow(
        'RPC response contained no data'
      )
    })

    it('rpcCallArray всегда даёт массив', async () => {
      mocks.appFetch.mockResolvedValueOnce(response({ result: 'success', data: [1, 2] }))
      await expect(rpcCallArray({ method: 'm', parameters: [] }, NODE)).resolves.toEqual([1, 2])
      mocks.appFetch.mockResolvedValueOnce(response({ result: 'success', data: null }))
      await expect(rpcCallArray({ method: 'm', parameters: [] }, NODE)).resolves.toEqual([])
    })
  })

  describe('fetchHttp', () => {
    it('подписанные данные на путь ноды, ответ — data', async () => {
      mocks.appFetch.mockResolvedValue(response({ data: { host: 'peertube' } }))
      await expect(
        fetchHttp({ path: 'peertube/best', data: { type: 'upload' }, options: NODE })
      ).resolves.toEqual({ host: 'peertube' })
      const [url, init] = mocks.appFetch.mock.calls[0]!
      expect(url).toBe('https://n1.pocketnet.app:8899/peertube/best')
      expect(JSON.parse(init.body)).toEqual({ type: 'upload', signature: 'sig' })
    })

    it('401 и Unauthorized в ответе — ошибка авторизации', async () => {
      mocks.appFetch.mockResolvedValueOnce(
        response({ error: 'bad sig' }, { status: 401, statusText: 'Unauthorized' })
      )
      await expect(fetchHttp({ path: 'x', data: {}, options: NODE })).rejects.toThrow(
        'Authentication failed: bad sig'
      )
      mocks.appFetch.mockResolvedValueOnce(response({ error: 'Unauthorized' }))
      await expect(fetchHttp({ path: 'x', data: {}, options: NODE })).rejects.toThrow(
        'Authentication failed: Unauthorized'
      )
    })

    it('без конкретной ноды — перебор: первая упала, вторая ответила', async () => {
      mocks.appFetch
        .mockResolvedValueOnce(response({}, { status: 503, statusText: 'Unavailable' }))
        .mockResolvedValueOnce(response({ ok: true }))
      await expect(fetchHttp({ path: 'x', data: {} })).resolves.toEqual({ ok: true })
      expect(mocks.appFetch).toHaveBeenCalledTimes(2)
    })
  })
})
