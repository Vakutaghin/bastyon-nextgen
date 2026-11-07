import { afterEach, describe, expect, it, vi } from 'vitest'
import { LegacyRpcError, normalizeError } from './bridge-helpers'
import type { RpcErrorBody } from '../types/messages'

const liveSignal = () => new AbortController().signal

describe('normalizeError', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('передаёт message/name и машинно-читаемый code', () => {
    const err = Object.assign(new Error('nope'), { code: 'permission_denied' })
    expect(normalizeError(err, liveSignal())).toMatchObject({
      message: 'nope',
      name: 'Error',
      code: 'permission_denied',
    })
  })

  // N23: стек — внутренности хоста (пути к модулям), в iframe ему не место.
  it('не отдаёт stack в прод-сборке', () => {
    vi.stubEnv('DEV', false)
    expect((normalizeError(new Error('boom'), liveSignal()) as RpcErrorBody).stack).toBeUndefined()
  })

  it('оставляет stack в dev — там он нужен для отладки', () => {
    vi.stubEnv('DEV', true)
    expect((normalizeError(new Error('boom'), liveSignal()) as RpcErrorBody).stack).toBeTypeOf(
      'string'
    )
  })

  it('ошибка в форме прежнего клиента уходит строкой как есть', () => {
    expect(normalizeError(new LegacyRpcError('cancel'), liveSignal())).toBe('cancel')
  })

  it('аборт превращается в timeout независимо от ошибки', () => {
    const ctrl = new AbortController()
    ctrl.abort()
    expect(normalizeError(new Error('whatever'), ctrl.signal)).toEqual({
      message: 'rpc_timeout',
      name: 'TimeoutError',
      code: 'timeout',
    })
  })
})
