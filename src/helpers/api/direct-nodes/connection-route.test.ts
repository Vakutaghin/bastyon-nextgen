// Выбор маршрута: в браузере и под Tor — только прокси; «Прокси»/«Ноды» — как
// выбрано; «Авто» — прокси, а если ни один не ответил, а ноды отвечают, ноды,
// и обратно на прокси, как только они ответят (по таймеру, при смене сети, при
// возврате в приложение). Сбой в фоне и сразу после возврата — не в счёт.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  available: vi.fn(() => true),
  alive: vi.fn(async () => true),
  tor: vi.fn(async () => 'direct'),
  nodes: vi.fn(async (): Promise<string[]> => ['1.2.3.4']),
}))
vi.mock('./native-link', () => ({ isNodeLinkAvailable: h.available }))
vi.mock('./node-pool', () => ({ directNodes: h.nodes }))
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
import { resetAppForegroundForTests, setAppActiveForTests } from '@/helpers/common/app-foreground'

describe('connectionRoute', () => {
  beforeEach(() => {
    localStorage.removeItem('bastyon_connection_mode')
    h.available.mockReturnValue(true)
    h.alive.mockReset().mockResolvedValue(true)
    h.tor.mockReset().mockResolvedValue('direct')
    h.nodes.mockReset().mockResolvedValue(['1.2.3.4'])
    resetAppForegroundForTests()
    resetConnectionRouteForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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

    // Через минуту прокси всё ещё молчат.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(connectionState.route).toBe('direct')

    h.alive.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(60_000)
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

  it('«Авто»: молчат и прокси, и ноды — сети нет, остаёмся на прокси', async () => {
    h.alive.mockResolvedValue(false)
    h.nodes.mockRejectedValue(new Error('No Pocketnet nodes answered directly'))
    expect(await connectionRoute()).toBe('proxy')
    expect(await reportProxiesUnreachable()).toBe(false)
    expect(connectionState.route).toBe('proxy')

    // Сеть появилась, прокси так и молчат, а ноды отвечают — на ноды.
    h.nodes.mockResolvedValue(['1.2.3.4'])
    expect(await reportProxiesUnreachable()).toBe(true)
    expect(connectionState.route).toBe('direct')
  })

  it('«Авто»: сбой в фоне, сразу после возврата и без сети — не повод уходить к нодам', async () => {
    vi.useFakeTimers()
    expect(await connectionRoute()).toBe('proxy')

    setAppActiveForTests(false)
    expect(await reportProxiesUnreachable()).toBe(false)
    setAppActiveForTests(true)
    expect(await reportProxiesUnreachable()).toBe(false)
    expect(h.nodes).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(15_000)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await reportProxiesUnreachable()).toBe(false)
    expect(connectionState.route).toBe('proxy')

    vi.restoreAllMocks()
    expect(await reportProxiesUnreachable()).toBe(true)
    expect(connectionState.route).toBe('direct')
  })

  it('«Авто» на нодах: вернулись в приложение — прокси перепроверяются сразу', async () => {
    h.alive.mockResolvedValue(false)
    expect(await connectionRoute()).toBe('direct')
    h.alive.mockClear().mockResolvedValue(true)
    setAppActiveForTests(false)
    setAppActiveForTests(true)
    await vi.waitFor(() => expect(connectionState.route).toBe('proxy'))
    expect(h.alive).toHaveBeenCalledTimes(1)
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
