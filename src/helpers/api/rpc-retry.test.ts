// Перебор нод: живая первой, на успехе — стикинесс, на сетевой ошибке нода
// помечается мёртвой и пробуется следующая. Структурированная ошибка ноды
// (code) другие ноды не спрашивает: ответ будет тот же — кроме HTTP 500 с
// «timeout» в теле (P2-3), это сетевой сбой под видом кода.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  orderedProxies: vi.fn(),
  markProxyAlive: vi.fn(),
  markProxyDead: vi.fn(),
}))
vi.mock('./node-selector', () => mocks)

import { isLogicError, isTimeout500 } from './rpc-errors'
import { retryWithBackoff } from './rpc-retry'

const A = { host: 'a.pocketnet.app', port: 8899 }
const B = { host: 'b.pocketnet.app', port: 8899 }
const C = { host: 'c.pocketnet.app', port: 8899 }

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
    expect(request).toHaveBeenCalledWith({ q: 1 }, A.host, A.port)
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
    expect(mocks.markProxyDead).toHaveBeenCalledWith(A)
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
