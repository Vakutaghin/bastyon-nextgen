// Карта сети в сторе: обход только по кнопке, карта сохраняется и при
// следующем открытии видна без запросов, пауза между обходами, прежняя
// карта не пропадает, если сеть не ответила.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  getByPRC: vi.fn(),
  probeProxy: vi.fn(),
}))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC }))
vi.mock('@/services/network-map/proxy-status', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/network-map/proxy-status')>()),
  probeProxy: mocks.probeProxy,
}))
vi.mock('@/services/network-map/ip-country', () => ({
  loadCountryTable: async () => ({
    date: '2026-10-28',
    lookup: (ip: string) => (ip.startsWith('10.') ? 'DE' : null),
  }),
}))

import { CRAWL_COOLDOWN_MS, useNetworkMapStore } from './network-map-store'

function peer(addr: string, inbound = false) {
  return {
    addr,
    services: '0000000000000409',
    relaytxes: true,
    conntime: 1,
    pingtime: 0.01,
    version: '/Satoshi:0.22.21/',
    inbound,
    synced_blocks: 100,
  }
}

function aliveProxies() {
  mocks.probeProxy.mockImplementation(async ({ host, port }: { host: string; port: number }) => ({
    host,
    port,
    ok: host === '1.pocketnet.app',
    pool: host === '1.pocketnet.app' ? [{ ip: '10.0.0.1', users: 5, fork: false }] : [],
  }))
}

function network() {
  mocks.getByPRC.mockImplementation(
    async (params: { method: string; options: { node: string } }) => {
      const node = params.options.node
      if (params.method === 'getnodeinfo') {
        return { result: 'success', node, data: { version: '0.22.21', lastblock: { height: 100 } } }
      }
      const peers: Record<string, unknown[]> = {
        '10.0.0.1:38081': [peer('10.0.0.2:37070'), peer('20.0.0.9:40000', true)],
        '10.0.0.2:38081': [peer('10.0.0.1:37070')],
      }
      return { result: 'success', node, data: peers[node] ?? [] }
    }
  )
}

describe('network-map-store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mocks.getByPRC.mockReset()
    mocks.probeProxy.mockReset()
  })

  it('без кнопки — ни одного запроса, карты нет', () => {
    const store = useNetworkMapStore()
    expect(store.hasMap).toBe(false)
    expect(mocks.probeProxy).not.toHaveBeenCalled()
    expect(mocks.getByPRC).not.toHaveBeenCalled()
  })

  it('обход собирает карту через прокси, определяет страны и сохраняет её', async () => {
    aliveProxies()
    network()
    const store = useNetworkMapStore()
    await store.crawl()

    expect(store.hasMap).toBe(true)
    expect(store.crawling).toBe(false)
    expect([...store.snapshot.nodes.keys()].sort()).toEqual(['10.0.0.1', '10.0.0.2', '20.0.0.9'])
    expect(store.snapshot.nodes.get('10.0.0.1')).toMatchObject({ answered: true, country: 'DE' })
    expect(store.snapshot.nodes.get('20.0.0.9')).toMatchObject({ listening: false, country: null })
    expect(store.snapshot.proxies).toHaveLength(6)
    // Вопросы — через живой прокси с названной нодой.
    expect(mocks.getByPRC).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'getpeerinfo',
        options: expect.objectContaining({ node: '10.0.0.1:38081' }),
      }),
      { host: '1.pocketnet.app', port: 8899 }
    )

    // Следующее открытие страницы — карта из сохранённой, без запросов.
    setActivePinia(createPinia())
    mocks.getByPRC.mockClear()
    const again = useNetworkMapStore()
    expect(again.hasMap).toBe(true)
    expect(again.snapshot.nodes.size).toBe(3)
    expect(mocks.getByPRC).not.toHaveBeenCalled()
  })

  it('после обхода — пауза: следующий только через минуту', async () => {
    aliveProxies()
    network()
    const store = useNetworkMapStore()
    await store.crawl()
    const taken = store.snapshot.takenAt
    expect(store.canCrawlIn(taken + 1000)).toBe(CRAWL_COOLDOWN_MS - 1000)
    expect(store.canCrawlIn(taken + CRAWL_COOLDOWN_MS)).toBe(0)
  })

  it('ни один прокси не ответил — «не удалось», прежняя карта на месте', async () => {
    aliveProxies()
    network()
    const store = useNetworkMapStore()
    await store.crawl()
    const before = store.snapshot

    mocks.probeProxy.mockImplementation(async ({ host, port }: { host: string; port: number }) => ({
      host,
      port,
      ok: false,
      pool: [],
    }))
    await store.crawl()
    expect(store.failed).toBe(true)
    expect(store.snapshot).toBe(before)
  })

  it('«Остановить» в начале обхода — прежняя карта остаётся', async () => {
    aliveProxies()
    network()
    const store = useNetworkMapStore()
    await store.crawl()
    const before = store.snapshot

    const running = store.crawl()
    store.stopCrawl()
    await running
    expect(store.snapshot).toBe(before)
    expect(store.crawling).toBe(false)
  })
})
