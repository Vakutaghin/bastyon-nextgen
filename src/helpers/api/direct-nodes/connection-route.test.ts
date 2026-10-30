// Выбор маршрута: в браузере и под Tor — только прокси; «Прокси»/«Ноды» — как
// выбрано; «Авто» — прокси, а если ни один не ответил, ноды, и обратно на
// прокси, как только они ответят (по таймеру, при смене сети, при возврате).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  available: vi.fn(() => true),
  alive: vi.fn(async () => true),
  tor: vi.fn(async () => 'direct'),
}))
vi.mock('./native-link', () => ({ isNodeLinkAvailable: h.available }))
vi.mock('../node-selector', () => ({ anyProxyAlive: h.alive }))
vi.mock('@/helpers/tor/tor-gate', () => ({ torRoutingMode: h.tor }))

import {
  connectionRoute,
  mayFallBackToDirect,
  onRouteChange,
  recheck,
  reportProxiesUnreachable,
  resetConnectionRouteForTests,
  setConnectionMode,
} from './connection-route'
import { connectionState } from './connection-state'

describe('connectionRoute', () => {
  beforeEach(() => {
    localStorage.removeItem('bastyon_connection_mode')
    h.available.mockReturnValue(true)
    h.alive.mockReset().mockResolvedValue(true)
    h.tor.mockReset().mockResolvedValue('direct')
    resetConnectionRouteForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
    resetConnectionRouteForTests()
  })

  it('в браузере и под Tor — прокси, даже если выбраны ноды', async () => {
    setConnectionMode('direct')
    h.available.mockReturnValue(false)
    expect(await connectionRoute()).toBe('proxy')
    h.available.mockReturnValue(true)
    h.tor.mockResolvedValue('tor')
    expect(await connectionRoute()).toBe('proxy')
    expect(await mayFallBackToDirect()).toBe(false)
  })

  it('«Прокси» и «Ноды напрямую» — как выбрано, выбор запоминается', async () => {
    setConnectionMode('direct')
    expect(await connectionRoute()).toBe('direct')
    expect(localStorage.getItem('bastyon_connection_mode')).toBe('direct')
    setConnectionMode('proxy')
    expect(await connectionRoute()).toBe('proxy')
    expect(h.alive).not.toHaveBeenCalled()
    expect(await reportProxiesUnreachable()).toBe(false)
  })

  it('«Авто»: прокси отвечают — прокси; решение не перепроверяется на каждый запрос', async () => {
    expect(connectionState.mode).toBe('auto')
    expect(await connectionRoute()).toBe('proxy')
    await connectionRoute()
    expect(h.alive).toHaveBeenCalledTimes(1)
  })

  it('«Авто»: прокси молчат — ноды; ответили снова — обратно и сокет переподключается', async () => {
    vi.useFakeTimers()
    const changes: string[] = []
    onRouteChange((r) => changes.push(r))
    h.alive.mockResolvedValue(false)
    expect(await connectionRoute()).toBe('direct')

    // Через три минуты прокси всё ещё молчат.
    await vi.advanceTimersByTimeAsync(3 * 60_000)
    expect(connectionState.route).toBe('direct')

    h.alive.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(3 * 60_000)
    expect(connectionState.route).toBe('proxy')
    expect(changes).toEqual(['proxy'])
    expect(await connectionRoute()).toBe('proxy')
  })

  it('«Авто»: прокси перестали отвечать по ходу — на ноды; сеть сменилась — проверка сразу', async () => {
    expect(await connectionRoute()).toBe('proxy')
    const changes: string[] = []
    onRouteChange((r) => changes.push(r))
    expect(await reportProxiesUnreachable()).toBe(true)
    expect(connectionState.route).toBe('direct')
    expect(changes).toEqual(['direct'])

    h.alive.mockClear().mockResolvedValue(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(connectionState.route).toBe('proxy'))
    expect(changes).toEqual(['direct', 'proxy'])
  })

  it('смена режима сбрасывает решение «Авто»', async () => {
    h.alive.mockResolvedValue(false)
    expect(await connectionRoute()).toBe('direct')
    setConnectionMode('proxy')
    expect(await connectionRoute()).toBe('proxy')
    // Вернулись в «Авто» — проверка заново.
    h.alive.mockClear().mockResolvedValue(true)
    setConnectionMode('auto')
    expect(await connectionRoute()).toBe('proxy')
    expect(h.alive).toHaveBeenCalled()
    await recheck()
  })
})
