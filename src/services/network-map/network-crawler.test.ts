// Обход сети: от нод пулов прокси к их соседям и дальше, пока новые не
// кончатся; ноды за роутером на карте есть, но их не спрашивают; ноду,
// которую прокси не знает, спрашиваем через другой прокси; кнопка
// «Остановить» обрывает обход.

import { describe, expect, it, vi } from 'vitest'
import type { PeerInfo } from '@/types/rpc-responses/get-peer-info'
import { crawlNetwork, type CrawlTransport } from './network-crawler'
import { emptySnapshot } from './network-snapshot'

function peer(addr: string, inbound = false): PeerInfo {
  return {
    addr,
    services: '0000000000000409',
    relaytxes: true,
    lastsend: 0,
    lastrecv: 0,
    conntime: 1_790_000_000,
    timeoffset: 0,
    pingtime: 0.05,
    protocol: 70016,
    version: '/Satoshi:0.22.21/',
    inbound,
    whitelisted: false,
    banscore: 0,
    startingheight: 1,
    synced_headers: 100,
    synced_blocks: 100,
  }
}

const P1 = { host: '1.pocketnet.app', port: 8899 }
const P3 = { host: '3.pocketnet.app', port: 8899 }

/**
 * Сеть: A — в пуле прокси; A знает B (открыта) и N (за роутером);
 * B знает C (открыта); C знает D, которую знает только второй прокси.
 */
const NETWORK: Record<string, PeerInfo[]> = {
  '10.0.0.1': [peer('10.0.0.2:37070'), peer('10.0.0.9:50000', true)],
  '10.0.0.2': [peer('10.0.0.1:37070'), peer('10.0.0.3:37070')],
  '10.0.0.3': [peer('10.0.0.2:37070'), peer('10.0.0.4:37070')],
  '10.0.0.4': [peer('10.0.0.3:37070')],
}

function transport(knownBy: (ip: string, host: string) => boolean = () => true): CrawlTransport {
  return {
    peers: vi.fn(async (apiNode: string, proxy: { host: string }) => {
      const ip = apiNode.replace(/:\d+$/, '')
      // Ноду, которую прокси не знает, он подменяет своей — как настоящий.
      if (!knownBy(ip, proxy.host)) return { node: '10.0.0.1:38081', peers: NETWORK['10.0.0.1']! }
      const peers = NETWORK[ip]
      if (!peers) throw new Error('timeout')
      return { node: apiNode, peers }
    }),
    info: vi.fn(async () => ({ version: '0.22.21', lastblock: { height: 100, hash: 'h' } })),
  }
}

describe('crawlNetwork', () => {
  it('обходит всех, кто принимает подключения; за роутером — на карте, но не спрошен', async () => {
    const snap = emptySnapshot()
    const t = transport()
    await crawlNetwork(snap, { proxies: [P1], seeds: ['10.0.0.1'], transport: t })

    expect([...snap.nodes.keys()].sort()).toEqual([
      '10.0.0.1',
      '10.0.0.2',
      '10.0.0.3',
      '10.0.0.4',
      '10.0.0.9',
    ])
    const asked = vi.mocked(t.peers).mock.calls.map(([apiNode]) => apiNode)
    expect(asked).not.toContain('10.0.0.9:38081')
    expect(snap).toMatchObject({ asked: 4, answered: 4 })
    expect(snap.nodes.get('10.0.0.9')).toMatchObject({ listening: false, answered: false })
    // Ответившие сказали и версию с высотой.
    expect(t.info).toHaveBeenCalledTimes(4)
  })

  it('прокси не знает ноду и отвечает своей — спрашиваем через другой прокси', async () => {
    const snap = emptySnapshot()
    // По очереди 10.0.0.4 достаётся второму прокси, а знает её только первый.
    const t = transport((ip, host) => ip !== '10.0.0.4' || host === P1.host)
    await crawlNetwork(snap, {
      proxies: [P1, P3],
      seeds: ['10.0.0.1'],
      transport: t,
      concurrency: 1,
    })
    expect(snap.nodes.get('10.0.0.4')).toMatchObject({ answered: true })
    const asks = vi
      .mocked(t.peers)
      .mock.calls.filter(([apiNode]) => apiNode === '10.0.0.4:38081')
      .map(([, proxy]) => proxy.host)
    expect(asks).toEqual([P3.host, P1.host])
  })

  it('не ответила — обход идёт дальше', async () => {
    const snap = emptySnapshot()
    await crawlNetwork(snap, {
      proxies: [P1],
      seeds: ['10.0.0.1', '10.0.0.77'],
      transport: transport(),
    })
    expect(snap.asked).toBe(5)
    expect(snap.answered).toBe(4)
  })

  it('«Остановить» обрывает обход: новых вопросов нет', async () => {
    const snap = emptySnapshot()
    const controller = new AbortController()
    const t = transport()
    const progress = vi.fn(() => controller.abort())
    await crawlNetwork(snap, {
      proxies: [P1],
      seeds: ['10.0.0.1'],
      transport: t,
      concurrency: 1,
      signal: controller.signal,
      onProgress: progress,
    })
    expect(t.peers).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenCalledTimes(1)
  })

  it('потолок вопросов — на случай огромной сети', async () => {
    const snap = emptySnapshot()
    const t = transport()
    await crawlNetwork(snap, { proxies: [P1], seeds: ['10.0.0.1'], transport: t, maxAsks: 2 })
    expect(t.peers).toHaveBeenCalledTimes(2)
  })

  it('IPv6 и ноду на самом прокси не спрашиваем: прокси до них не дотянется', async () => {
    const snap = emptySnapshot()
    const t = transport()
    await crawlNetwork(snap, {
      proxies: [P1],
      seeds: ['2a01::1', 'local@3.pocketnet.app'],
      transport: t,
    })
    expect(t.peers).not.toHaveBeenCalled()
  })
})
