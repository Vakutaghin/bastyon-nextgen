// Fail-closed маршрутизация при включённом Tor (V20): пока Tor не готов,
// запрос ждёт или падает — но никогда не идёт напрямую.

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTorStore } from '@/stores/tor-store'
import {
  TorNotReadyError,
  isTorNotReadyError,
  routingModeOf,
  torRoutingMode,
  waitForTorRouting,
} from './tor-gate'

describe('routingModeOf', () => {
  it('без Tauri или с выключенным Tor — direct', () => {
    expect(routingModeOf({ available: false, enabled: true, status: 'ready' })).toBe('direct')
    expect(routingModeOf({ available: true, enabled: false, status: 'ready' })).toBe('direct')
  })

  it('ready — tor, failed — failed, остальное — wait (никогда не direct)', () => {
    const base = { available: true, enabled: true } as const
    expect(routingModeOf({ ...base, status: 'ready' })).toBe('tor')
    expect(routingModeOf({ ...base, status: 'failed' })).toBe('failed')
    for (const status of ['off', 'installing', 'starting', 'bootstrapping'] as const) {
      expect(routingModeOf({ ...base, status })).toBe('wait')
    }
  })
})

describe('waitForTorRouting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function torStore(status: 'off' | 'bootstrapping' | 'ready' | 'failed' = 'bootstrapping') {
    const store = useTorStore()
    store.available = true
    store.enabled = true
    store.status = status
    return store
  }

  it('резолвится tor, когда статус доходит до ready', async () => {
    const store = torStore()
    const p = waitForTorRouting({ timeoutMs: 5_000 })
    store.status = 'ready'
    await expect(p).resolves.toBe('tor')
  })

  it('резолвится direct, если пользователь выключил Tor во время ожидания', async () => {
    const store = torStore()
    const p = waitForTorRouting({ timeoutMs: 5_000 })
    store.enabled = false
    await expect(p).resolves.toBe('direct')
  })

  it('резолвится failed при падении Tor — вызывающий не должен идти напрямую', async () => {
    const store = torStore()
    const p = waitForTorRouting({ timeoutMs: 5_000 })
    store.status = 'failed'
    await expect(p).resolves.toBe('failed')
  })

  it('abort-сигнал вызывающего прерывает ожидание AbortError', async () => {
    torStore()
    const ctrl = new AbortController()
    const p = waitForTorRouting({ signal: ctrl.signal, timeoutMs: 5_000 })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('уже сработавший сигнал — сразу AbortError', async () => {
    torStore()
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(waitForTorRouting({ signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('таймаут ожидания — TorNotReadyError(timeout)', async () => {
    vi.useFakeTimers()
    torStore()
    const p = waitForTorRouting({ timeoutMs: 1_000 })
    const assertion = expect(p).rejects.toSatisfy((e: unknown) => {
      return isTorNotReadyError(e) && (e as TorNotReadyError).reason === 'timeout'
    })
    await vi.advanceTimersByTimeAsync(1_000)
    await assertion
  })

  it('не в wait — возвращает текущий режим без ожидания', async () => {
    torStore('ready')
    await expect(waitForTorRouting()).resolves.toBe('tor')
    await expect(torRoutingMode()).resolves.toBe('tor')
  })
})

describe('torRoutingMode без pinia', () => {
  it('деградирует в direct (тесты/воркеры без стора)', async () => {
    // Активной pinia нет — useTorStore бросит, гейт ловит.
    setActivePinia(undefined as unknown as ReturnType<typeof createPinia>)
    await expect(torRoutingMode()).resolves.toBe('direct')
  })
})
