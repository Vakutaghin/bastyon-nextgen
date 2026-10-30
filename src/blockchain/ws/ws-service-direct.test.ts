// Уведомления напрямую от ноды (режим подключения «Ноды»): сокет к лучшей
// ноде на WSS-порт, подписка адресом без подписи (как её делает прокси),
// `{result: 'Registered'}` — это подтверждение; нода не открыла сокет —
// следующая попытка возьмёт другую; маршрут сменился — сокет переоткрывается.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { FakeNodeSocket } = vi.hoisted(() => {
  class FakeNodeSocket {
    static instances: FakeNodeSocket[] = []
    readyState = 0
    sent: string[] = []
    onopen: (() => void) | null = null
    onmessage: ((ev: { data: string }) => void) | null = null
    onclose: ((ev: { code: number; reason: string }) => void) | null = null
    onerror: ((ev: unknown) => void) | null = null
    constructor(
      readonly host: string,
      readonly port: number
    ) {
      FakeNodeSocket.instances.push(this)
    }
    send(data: string) {
      this.sent.push(data)
    }
    close() {
      this.readyState = 3
    }
    open() {
      this.readyState = 1
      this.onopen?.()
    }
    message(obj: unknown) {
      this.onmessage?.({ data: JSON.stringify(obj) })
    }
    serverClose() {
      this.readyState = 3
      this.onclose?.({ code: 1006, reason: '' })
    }
  }
  return { FakeNodeSocket }
})

const h = vi.hoisted(() => ({
  route: vi.fn(async () => 'direct'),
  routeListeners: [] as Array<(r: string) => void>,
  nodes: vi.fn(async () => ['1.1.1.1', '2.2.2.2']),
  dead: vi.fn(),
  auth: { getKeyPair: { ecPair: {} } as unknown, getUserAddress: 'PAddr' as unknown },
}))
vi.mock('@/helpers/api/direct-nodes/connection-route', () => ({
  connectionRoute: h.route,
  onRouteChange: (fn: (r: string) => void) => {
    h.routeListeners.push(fn)
    return () => {}
  },
}))
vi.mock('@/helpers/api/direct-nodes/node-pool', () => ({
  directNodes: h.nodes,
  markNodeDead: h.dead,
}))
vi.mock('@/helpers/api/direct-nodes/node-websocket', () => ({ NodeWebSocket: FakeNodeSocket }))
vi.mock('@/helpers/tor/tor-websocket', () => ({ pickWebSocketCtor: vi.fn() }))
vi.mock('@/helpers/api/node-selector', () => ({ orderedProxies: vi.fn(async (l: unknown) => l) }))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: vi.fn() }))
vi.mock('@/blockchain/core/signatures', () => ({ generateApiSignature: vi.fn() }))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => h.auth }))

import { wsService } from './ws-service'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ws-service: ноды напрямую', () => {
  beforeEach(() => {
    FakeNodeSocket.instances = []
    h.route.mockReset().mockResolvedValue('direct')
    h.nodes.mockReset().mockResolvedValue(['1.1.1.1', '2.2.2.2'])
    h.dead.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    wsService.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('подписка у ноды — адресом без подписи; Registered — подтверждение', async () => {
    const registered = vi.fn()
    wsService.on('registered', registered)
    await wsService.connect()
    const ws = FakeNodeSocket.instances[0]!
    expect([ws.host, ws.port]).toEqual(['1.1.1.1', 8887])
    ws.open()
    await flush()
    expect(JSON.parse(ws.sent[0]!)).toEqual({
      addr: 'PAddr',
      nonce: '0',
      signature: '0',
      pubkey: '0',
    })

    ws.message({ result: 'Registered' })
    expect(registered).toHaveBeenCalledWith(expect.objectContaining({ addr: 'PAddr' }))

    const block = vi.fn()
    wsService.on('block', block)
    ws.message({ addr: 'PAddr', msg: 'new block', height: 10 })
    expect(block).toHaveBeenCalledWith(expect.objectContaining({ height: 10 }))
  })

  it('нода не открыла сокет — отмечена мёртвой, переподключение', async () => {
    vi.useFakeTimers()
    await wsService.connect()
    FakeNodeSocket.instances[0]!.serverClose()
    expect(h.dead).toHaveBeenCalledWith('1.1.1.1')
    await vi.advanceTimersByTimeAsync(2500)
    expect(FakeNodeSocket.instances).toHaveLength(2)
  })

  it('маршрут сменился — сокет переоткрывается', async () => {
    await wsService.connect()
    FakeNodeSocket.instances[0]!.open()
    h.routeListeners.forEach((fn) => fn('proxy'))
    await flush()
    expect(FakeNodeSocket.instances[0]!.readyState).toBe(3)
    expect(FakeNodeSocket.instances).toHaveLength(2)
  })
})
