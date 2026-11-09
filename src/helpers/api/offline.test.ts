// Без сети запрос не уходит: сразу OfflineError, без перебора прокси. Своя
// нода на этом же компьютере доступна и без сети.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { assertOnline, isLoopbackHost, isOfflineError, isOfflineNow, OfflineError } from './offline'

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

afterEach(() => vi.restoreAllMocks())

describe('offline', () => {
  it('onLine=false — сети точно нет; true — запросы идут', () => {
    setOnline(false)
    expect(isOfflineNow()).toBe(true)
    expect(() => assertOnline('getnodeinfo')).toThrow(OfflineError)
    setOnline(true)
    expect(isOfflineNow()).toBe(false)
    expect(() => assertOnline('getnodeinfo')).not.toThrow()
  })

  it('своя нода на этом компьютере — и без сети', () => {
    setOnline(false)
    for (const host of ['localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]']) {
      expect(isLoopbackHost(host)).toBe(true)
      expect(() => assertOnline('x', host)).not.toThrow()
    }
    expect(isLoopbackHost('1.pocketnet.app')).toBe(false)
    expect(isLoopbackHost('192.168.1.10')).toBe(false)
    expect(() => assertOnline('x', '1.pocketnet.app')).toThrow(OfflineError)
  })

  it('признак ошибки переживает копирование, без instanceof', () => {
    const err = new OfflineError('rpc')
    expect(isOfflineError(err)).toBe(true)
    expect(isOfflineError({ ...err, offline: true })).toBe(true)
    expect(isOfflineError(new Error('No network'))).toBe(false)
    expect(isOfflineError(null)).toBe(false)
  })
})
