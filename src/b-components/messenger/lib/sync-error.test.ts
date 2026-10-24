// Причина ошибки синка — из того, что matrix-js-sdk кладёт в событие 'sync'.

import { describe, expect, it } from 'vitest'
import { syncErrorReason } from './sync-error'

class ConnectionError extends Error {
  override get name() {
    return 'ConnectionError'
  }
}

describe('syncErrorReason', () => {
  it('сервер сбросил вход — token', () => {
    expect(syncErrorReason({ httpStatus: 401, errcode: 'M_UNKNOWN_TOKEN' })).toMatchObject({
      kind: 'token',
      detail: 'M_UNKNOWN_TOKEN',
    })
  })

  it('ответ с ошибкой — код и errcode', () => {
    expect(syncErrorReason({ httpStatus: 502 })).toEqual({
      kind: 'server',
      status: 502,
      detail: 'HTTP 502',
    })
    expect(syncErrorReason({ httpStatus: 429, errcode: 'M_LIMIT_EXCEEDED' }).detail).toBe(
      'HTTP 429 M_LIMIT_EXCEEDED'
    )
  })

  it('нет связи и таймаут', () => {
    expect(syncErrorReason(new ConnectionError('fetch failed: Failed to fetch'))).toEqual({
      kind: 'network',
      detail: 'fetch failed: Failed to fetch',
    })
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    expect(syncErrorReason(abort).kind).toBe('timeout')
  })

  it('Tor не готов — и напрямую, и внутри ConnectionError', () => {
    expect(syncErrorReason(Object.assign(new Error('x'), { name: 'TorNotReadyError' })).kind).toBe(
      'tor'
    )
    expect(
      syncErrorReason(new ConnectionError('fetch failed: Tor is enabled but failed; refusing')).kind
    ).toBe('tor')
  })

  it('непонятное — как есть, без падений', () => {
    expect(syncErrorReason(undefined)).toEqual({ kind: 'unknown', detail: '' })
    expect(syncErrorReason(new TypeError('boom')).detail).toBe('TypeError: boom')
  })
})
