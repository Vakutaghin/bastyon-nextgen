// Перебор нод: живая первой, на успехе — стикинесс, на сетевой ошибке нода
// помечается мёртвой и пробуется следующая. Структурированная ошибка ноды
// (code) другие ноды не спрашивает: ответ будет тот же — кроме HTTP 500 с
// «timeout» в теле (P2-3), это сетевой сбой под видом кода.
//
// Сеть есть, а интернета нет (reachability): долгий запрос пингует свой
// прокси и, если тот молчит, обрывается; после сбоя остальные спрашиваются,
// только если кто-то ответил на пинг, — первыми ответившие.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  orderedProxies: vi.fn(),
  markProxyAlive: vi.fn(),
  markProxyDead: vi.fn(),
  pingProxy: vi.fn(),
}))
vi.mock('./node-selector', () => mocks)

import {
  LIVENESS_AFTER_MS,
  SUSPECT_AFTER_MS,
  isUnreachable,
  noteUnreachable,
  probeRound,
  proxyAnswers,
  resetReachabilityForTests,
} from './reachability'
import { isLogicError, isNodeTimeout, isTimeout500 } from './rpc-errors'
import { noProxyAnswered, retryWithBackoff } from './rpc-retry'

const A = { host: 'a.pocketnet.app', port: 8899 }
const B = { host: 'b.pocketnet.app', port: 8899 }
const C = { host: 'c.pocketnet.app', port: 8899 }
const D = { host: 'd.pocketnet.app', port: 8899 }

beforeEach(() => {
  resetReachabilityForTests()
  // По умолчанию на пинг отвечают все.
  mocks.pingProxy.mockReset().mockResolvedValue(true)
})
afterEach(() => {
  vi.useRealTimers()
  resetReachabilityForTests()
})

describe('rpc-errors', () => {
  it.each([
    [{ code: -26, message: 'duplicate' }, true],
    [{ error: { code: 18, message: 'score limit' } }, true],
    [{ error: 'plain string' }, false],
    [new Error('socket hang up'), false],
    [null, false],
    ['text', false],
  ])('isLogicError(%j) → %s', (error, expected) => {
    expect(isLogicError(error)).toBe(expected)
  })

  it.each([
    [{ httpStatus: 500, message: 'sql request timeout' }, true],
    [{ httpStatus: 500, error: { message: 'Timeout expired' } }, true],
    [
      {
        httpStatus: 500,
        message: 'failed: {"code":408,"message":"GetAccountProfiles: sql request timeout"}',
      },
      true,
    ],
    [{ httpStatus: 500, message: '{"code":408,"error":"TIMEOUT"}' }, true],
    [{ httpStatus: 500, message: 'bad request' }, false],
    [{ httpStatus: 500, message: 'failed: {"code":500,"message":"disk full"}' }, false],
    [{ httpStatus: 500, message: 'failed: {broken json' }, false],
    [{ httpStatus: 502, message: 'timeout' }, false],
    [null, false],
  ])('isTimeout500(%j) → %s', (error, expected) => {
    expect(isTimeout500(error)).toBe(expected)
  })
})

describe('retryWithBackoff', () => {
  beforeEach(() => {
    mocks.orderedProxies.mockReset().mockImplementation(async (list: unknown[]) => list)
    mocks.markProxyAlive.mockReset()
    mocks.markProxyDead.mockReset()
  })

  it('первая живая нода отвечает — остальные не трогаются, нода помечена живой', async () => {
    const request = vi.fn().mockResolvedValue({ result: 'success' })
    await expect(
      retryWithBackoff({ q: 1 }, { servers: [A, B], request, protocolName: 'RPC' })
    ).resolves.toEqual({ result: 'success' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({ q: 1 }, A.host, A.port, expect.any(AbortSignal))
    // Ответ быстрее LIVENESS_AFTER_MS — пинга нет.
    expect(mocks.pingProxy).not.toHaveBeenCalled()
    expect(mocks.markProxyAlive).toHaveBeenCalledWith(A)
  })

  it('порядок — от node-selector (живая первой)', async () => {
    mocks.orderedProxies.mockResolvedValue([C, A, B])
    const request = vi.fn().mockResolvedValue('ok')
    await retryWithBackoff({}, { servers: [A, B, C], request, protocolName: 'RPC' })
    expect(request.mock.calls[0]![1]).toBe(C.host)
  })

  it('сетевая ошибка: нода мёртвая, пробуется следующая', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('ok')
    await expect(
      retryWithBackoff({}, { servers: [A, B], request, protocolName: 'RPC' })
    ).resolves.toBe('ok')
    expect(mocks.markProxyDead).toHaveBeenCalledWith(A)
    expect(mocks.markProxyAlive).toHaveBeenCalledWith(B)
  })

  it('логическая ошибка RPC сразу пробрасывается, без перебора и без пометки мёртвой', async () => {
    const logic = { code: -26, message: 'bad-txns' }
    const request = vi.fn().mockRejectedValue(logic)
    await expect(
      retryWithBackoff(
        {},
        { servers: [A, B], request, protocolName: 'RPC', isLogicErrorThrowable: true }
      )
    ).rejects.toBe(logic)
    expect(request).toHaveBeenCalledTimes(1)
    expect(mocks.markProxyDead).not.toHaveBeenCalled()
  })

  it('HTTP 500 с timeout — перебор продолжается, хоть у ошибки и есть code', async () => {
    const timeout = { code: 408, httpStatus: 500, message: 'sql request timeout' }
    const request = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce('ok')
    await expect(
      retryWithBackoff(
        {},
        { servers: [A, B], request, protocolName: 'RPC', isLogicErrorThrowable: true }
      )
    ).resolves.toBe('ok')
    // Прокси ответил — не успела нода за ним: он живой.
    expect(mocks.markProxyDead).not.toHaveBeenCalled()
    expect(mocks.markProxyAlive).toHaveBeenCalledWith(A)
  })

  it('нода не успевает раз за разом — после двух таких ответов перебор кончается', async () => {
    const timeout = {
      code: 500,
      httpStatus: 500,
      error: { message: '{"code":408,"message":"GetHistoricalFeed: sql request timeout"}' },
    }
    const request = vi.fn().mockRejectedValue(timeout)
    const error = await retryWithBackoff(
      {},
      { servers: [A, B, C], request, protocolName: 'RPC', isLogicErrorThrowable: true }
    ).catch((e: unknown) => e)
    expect(request).toHaveBeenCalledTimes(2)
    expect(mocks.markProxyDead).not.toHaveBeenCalled()
    expect(isNodeTimeout(error)).toBe(true)
    expect(isNodeTimeout(new Error('ECONNRESET'))).toBe(false)
  })

  it('HTTP-режим перебирает ноды и на логических ошибках', async () => {
    const request = vi.fn().mockRejectedValueOnce({ code: 1 }).mockResolvedValueOnce('ok')
    await expect(
      retryWithBackoff({}, { servers: [A, B], request, protocolName: 'HTTP' })
    ).resolves.toBe('ok')
  })

  it('все ноды упали — одна ошибка с последней причиной и списком всех', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce('second as string')
    const error = (await retryWithBackoff(
      {},
      { servers: [A, B], request, protocolName: 'HTTP' }
    ).catch((e: unknown) => e)) as Error & { allErrors: Error[] }
    expect(error.message).toBe('All HTTP servers failed. Last error: second as string')
    expect(error.allErrors.map((e) => e.message)).toEqual(['first', 'second as string'])
  })

  it('пустой список серверов — понятная ошибка', async () => {
    await expect(
      retryWithBackoff({}, { servers: [], request: vi.fn(), protocolName: 'RPC' })
    ).rejects.toThrow('No RPC servers available')
  })
})

describe('сеть пропала посреди перебора', () => {
  it('остальные прокси не спрашиваем и мёртвыми не помечаем', async () => {
    mocks.orderedProxies.mockResolvedValue([A, B, C])
    mocks.markProxyDead.mockClear()
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const request = vi.fn(async () => {
      online.mockReturnValue(false)
      throw new TypeError('Failed to fetch')
    })
    await expect(
      retryWithBackoff({}, { servers: [A, B, C], request, protocolName: 'RPC' })
    ).rejects.toMatchObject({ offline: true })
    expect(request).toHaveBeenCalledTimes(1)
    expect(mocks.markProxyDead).not.toHaveBeenCalled()
    online.mockRestore()
  })
})

describe('сеть есть, интернета нет', () => {
  beforeEach(() => {
    mocks.orderedProxies.mockReset().mockImplementation(async (list: unknown[]) => list)
    mocks.markProxyAlive.mockReset()
    mocks.markProxyDead.mockReset()
  })

  /** Пинг по хостам: true/false — ответ, undefined — молчит, пока не истечёт тест. */
  function pings(answers: Record<string, boolean | undefined>) {
    mocks.pingProxy.mockImplementation((server: { host: string }) => {
      const answer = answers[server.host]
      return answer === undefined ? new Promise(() => {}) : Promise.resolve(answer)
    })
  }

  it('сбой, и на пинг не ответил никто — остальных не спрашиваем, noProxyAnswered', async () => {
    pings({ [A.host]: false, [B.host]: false, [C.host]: false })
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await retryWithBackoff(
      {},
      { servers: [A, B, C], request, protocolName: 'RPC' }
    ).catch((e: unknown) => e)
    expect(request).toHaveBeenCalledTimes(1)
    expect(noProxyAnswered(error)).toBe(true)
    expect((error as Error).message).toMatch(/^All RPC servers failed/)
    expect(mocks.pingProxy).toHaveBeenCalledTimes(3)
    expect(noProxyAnswered(new Error('x'))).toBe(false)
    expect(noProxyAnswered(null)).toBe(false)
  })

  it('кто-то ответил — перебор идёт, без noProxyAnswered', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await retryWithBackoff(
      {},
      { servers: [A, B], request, protocolName: 'RPC' }
    ).catch((e: unknown) => e)
    expect(request).toHaveBeenCalledTimes(2)
    expect(noProxyAnswered(error)).toBe(false)
  })

  it('после сбоя первыми — ответившие на пинг, неизвестные — следом, молчавшие — в конце', async () => {
    pings({ [A.host]: false, [B.host]: false, [C.host]: undefined, [D.host]: true })
    const request = vi.fn(async (_p: unknown, host: string) => {
      if (host === C.host) return 'ok'
      throw new TypeError('Failed to fetch')
    })
    await expect(
      retryWithBackoff({}, { servers: [A, B, C, D], request, protocolName: 'RPC' })
    ).resolves.toBe('ok')
    expect(request.mock.calls.map(([, host]) => host)).toEqual([A.host, D.host, C.host])
  })

  it('прокси молчит дольше LIVENESS_AFTER_MS и не отвечает на пинг — обрыв, а не 30 с', async () => {
    vi.useFakeTimers()
    let release: (ok: boolean) => void = () => {}
    mocks.pingProxy.mockImplementation((server: { host: string }) =>
      server.host === A.host
        ? new Promise<boolean>((resolve) => (release = resolve))
        : Promise.resolve(true)
    )
    const aborted: number[] = []
    const t0 = Date.now()
    const request = vi.fn(
      (_p: unknown, host: string, _port: number, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          if (host === B.host) return resolve('from B')
          signal?.addEventListener('abort', () => {
            aborted.push(Date.now() - t0)
            reject(new Error('aborted'))
          })
        })
    )
    const done = retryWithBackoff({}, { servers: [A, B], request, protocolName: 'RPC' })

    await vi.advanceTimersByTimeAsync(LIVENESS_AFTER_MS - 1)
    expect(mocks.pingProxy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.pingProxy).toHaveBeenCalledWith(A, expect.any(Number))
    expect(aborted).toEqual([])
    await vi.advanceTimersByTimeAsync(3_000)
    release(false)
    await expect(done).resolves.toBe('from B')
    expect(aborted).toEqual([LIVENESS_AFTER_MS + 3_000])
    expect(mocks.markProxyDead).toHaveBeenCalledWith(A)
  })

  it('прокси думает долго, но на пинг отвечает — ждём его ответа', async () => {
    vi.useFakeTimers()
    const request = vi.fn(
      (_p: unknown, _h: string, _port: number, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          setTimeout(() => resolve('slow but fine'), 12_000)
          signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const done = retryWithBackoff({}, { servers: [A, B], request, protocolName: 'RPC' })
    await vi.advanceTimersByTimeAsync(12_000)
    await expect(done).resolves.toBe('slow but fine')
    expect(request).toHaveBeenCalledTimes(1)
    expect(mocks.pingProxy).toHaveBeenCalledTimes(1)
  })

  it('ответ прокси (и ошибка ноды через него) — связь есть', async () => {
    noteUnreachable()
    await retryWithBackoff(
      {},
      { servers: [A], request: vi.fn().mockResolvedValue('ok'), protocolName: 'RPC' }
    )
    expect(isUnreachable()).toBe(false)

    noteUnreachable()
    const logic = { code: -26, message: 'bad-txns' }
    await retryWithBackoff(
      {},
      {
        servers: [A],
        request: vi.fn().mockRejectedValue(logic),
        protocolName: 'RPC',
        isLogicErrorThrowable: true,
      }
    ).catch(() => {})
    expect(isUnreachable()).toBe(false)

    noteUnreachable()
    const timeout = { code: 408, httpStatus: 500, message: 'sql request timeout' }
    pings({ [A.host]: false })
    await retryWithBackoff(
      {},
      {
        servers: [A],
        request: vi.fn().mockRejectedValue(timeout),
        protocolName: 'RPC',
        isLogicErrorThrowable: true,
      }
    ).catch(() => {})
    expect(isUnreachable()).toBe(false)
  })

  it('старый ответ на пинг не в счёт: проверка долгого запроса пингует заново', async () => {
    vi.useFakeTimers()
    await proxyAnswers(A)
    await vi.advanceTimersByTimeAsync(10_000)
    pings({ [A.host]: false, [B.host]: true })
    const request = vi.fn(
      (_p: unknown, host: string, _port: number, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          if (host === B.host) return resolve('from B')
          signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const done = retryWithBackoff({}, { servers: [A, B], request, protocolName: 'RPC' })
    await vi.advanceTimersByTimeAsync(LIVENESS_AFTER_MS)
    await expect(done).resolves.toBe('from B')
  })

  it('старый круг «все живы» не в счёт: после сбоя — свежий пинг, и молчат все', async () => {
    vi.useFakeTimers()
    await probeRound([A, B, C]).any
    await vi.advanceTimersByTimeAsync(1_000)
    pings({ [A.host]: false, [B.host]: false, [C.host]: false })
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await retryWithBackoff(
      {},
      { servers: [A, B, C], request, protocolName: 'RPC' }
    ).catch((e: unknown) => e)
    expect(noProxyAnswered(error)).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('свой молчит и на пинг дольше SUSPECT_AFTER_MS — остальных пингуем, не дожидаясь', async () => {
    vi.useFakeTimers()
    // Пинги не отвечают вовсе: смотрим, когда кого начали пинговать.
    const started: Array<[string, number]> = []
    const t0 = Date.now()
    mocks.pingProxy.mockImplementation((server: { host: string }) => {
      started.push([server.host, Date.now() - t0])
      return new Promise(() => {})
    })
    const request = vi.fn(() => new Promise(() => {}))
    void retryWithBackoff({}, { servers: [A, B, C], request, protocolName: 'RPC' })
    await vi.advanceTimersByTimeAsync(LIVENESS_AFTER_MS + SUSPECT_AFTER_MS - 1)
    expect(started).toEqual([[A.host, LIVENESS_AFTER_MS]])
    await vi.advanceTimersByTimeAsync(1)
    expect(started).toEqual([
      [A.host, LIVENESS_AFTER_MS],
      [B.host, LIVENESS_AFTER_MS + SUSPECT_AFTER_MS],
      [C.host, LIVENESS_AFTER_MS + SUSPECT_AFTER_MS],
    ])
  })

  it('запрос ответил, пока свой пинг ещё идёт, — остальных уже не пингуем', async () => {
    vi.useFakeTimers()
    mocks.pingProxy.mockImplementation(() => new Promise(() => {}))
    const request = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve('ok'), LIVENESS_AFTER_MS + 1_000))
    )
    const done = retryWithBackoff({}, { servers: [A, B, C], request, protocolName: 'RPC' })
    await vi.advanceTimersByTimeAsync(LIVENESS_AFTER_MS + 1_000)
    await expect(done).resolves.toBe('ok')
    await vi.advanceTimersByTimeAsync(SUSPECT_AFTER_MS * 2)
    expect(mocks.pingProxy.mock.calls.map(([s]) => s.host)).toEqual([A.host])
  })

  it('свой ответил на пинг быстро — остальных не пингуем', async () => {
    vi.useFakeTimers()
    const request = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 20_000)))
    const done = retryWithBackoff({}, { servers: [A, B, C], request, protocolName: 'RPC' })
    await vi.advanceTimersByTimeAsync(20_000)
    await expect(done).resolves.toBe('slow')
    expect(mocks.pingProxy.mock.calls.map(([s]) => s.host)).toEqual([A.host])
  })

  it('общий список не переставляется', async () => {
    const shared = [A, B, C]
    pings({ [A.host]: false, [B.host]: false, [C.host]: true })
    const request = vi.fn(async (_p: unknown, host: string) => {
      if (host === C.host) return 'ok'
      throw new TypeError('Failed to fetch')
    })
    await retryWithBackoff({}, { servers: shared, request, protocolName: 'RPC' })
    expect(shared).toEqual([A, B, C])
  })
})
