// Выбор нод: высоте одной ноды не верим, на одной высоте хэш блока один,
// рабочие — по скорости; не ответившая нода уходит из рабочих; соседи нод
// пополняют список.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('./node-call', () => ({ nodeCall: h.call }))

import servers from '@/servers.json'
import { connectionState } from './connection-state'
import { NodePinMismatchError } from './native-link'
import {
  agreeingNodes,
  directNodes,
  isPublicIpv4,
  learnNodes,
  markNodeDead,
  resetDirectNodesForTests,
  type NodeProbe,
} from './node-pool'

const SEEDS = servers.servers.production.nodes.seeds
const p = (host: string, height: number, hash = `h${height}`, ms = 10): NodeProbe => ({
  host,
  height,
  hash,
  ms,
})

describe('agreeingNodes', () => {
  it('одна нода с завышенной высотой не тянет выбор за собой', () => {
    const good = agreeingNodes([p('a', 100), p('b', 99), p('c', 5000), p('d', 100, 'h100', 5)])
    expect(good.map((n) => n.host)).toEqual(['d', 'a', 'b'])
  })

  it('на одной высоте другой хэш — меньшинство отбрасывается', () => {
    const good = agreeingNodes([p('a', 100, 'x'), p('b', 100, 'x'), p('c', 100, 'fork')])
    expect(good.map((n) => n.host).sort()).toEqual(['a', 'b'])
  })

  it('отстающие больше чем на два блока — не годятся; одна нода годится сама', () => {
    expect(agreeingNodes([p('a', 100), p('b', 100), p('c', 90)]).map((n) => n.host)).toEqual([
      'a',
      'b',
    ])
    expect(agreeingNodes([p('a', 7)])).toHaveLength(1)
    expect(agreeingNodes([])).toEqual([])
  })
})

describe('isPublicIpv4', () => {
  it('частные, служебные и IPv6 — нет', () => {
    expect(isPublicIpv4('109.197.196.106')).toBe(true)
    for (const host of [
      '10.0.0.1',
      '192.168.1.2',
      '172.20.0.1',
      '127.0.0.1',
      '100.64.1.1',
      '::1',
      '1.2.3',
    ]) {
      expect(isPublicIpv4(host)).toBe(false)
    }
  })
})

function answerAll(height = 4_000_000): void {
  h.call.mockImplementation(async (host: string, method: string) => {
    if (method === 'getnodeinfo')
      return { chain: 'main', lastblock: { height, hash: `b${height}` } }
    if (method === 'getpeerinfo') return [{ addr: '8.8.4.4:37070' }, { addr: '10.0.0.5:37070' }]
    throw new Error(`unexpected ${host} ${method}`)
  })
}

describe('directNodes', () => {
  beforeEach(() => {
    h.call.mockReset()
    resetDirectNodesForTests()
  })

  it('опрашивает ноды по нескольку и останавливается, найдя согласных', async () => {
    answerAll()
    const hosts = await directNodes()
    expect(hosts.length).toBeGreaterThanOrEqual(3)
    expect(hosts.length).toBeLessThanOrEqual(5)
    const probed = h.call.mock.calls.filter(([, m]) => m === 'getnodeinfo').length
    expect(probed).toBeLessThan(SEEDS.length)
    expect(connectionState.nodes).toBe(hosts.length)
    expect(connectionState.node).toBe(hosts[0])

    // Второй раз — без опроса, пока выбор свежий.
    h.call.mockClear()
    expect(await directNodes()).toEqual(hosts)
    expect(h.call).not.toHaveBeenCalled()
  })

  it('не ответившая нода уходит из рабочих; кончились — выбор заново', async () => {
    answerAll()
    const hosts = await directNodes()
    markNodeDead(hosts[0]!)
    expect((await directNodes())[0]).toBe(hosts[1])
    for (const host of hosts) markNodeDead(host)
    expect(connectionState.nodes).toBe(0)
    const again = await directNodes()
    expect(again.some((h) => hosts.includes(h))).toBe(false)
  })

  it('ноды прошлого выбора спрашиваются первыми', async () => {
    answerAll()
    const hosts = await directNodes()
    resetDirectNodesForTests()
    // reset стирает и хранилище — кладём прошлый выбор сами.
    localStorage.setItem('bastyon_direct_nodes', JSON.stringify({ good: hosts, learned: [] }))
    h.call.mockClear()
    await directNodes()
    const firstAsked = h.call.mock.calls.slice(0, hosts.length).map(([host]) => host)
    expect(firstAsked).toEqual(hosts)
  })

  it('никто не ответил или все сменили сертификат — ошибка и отметка для настроек', async () => {
    h.call.mockRejectedValue(new NodePinMismatchError('x'))
    await expect(directNodes()).rejects.toThrow(/No Pocketnet nodes/)
    expect(connectionState.selectFailed).toBe(true)
  })

  it('соседи нод пополняют список; частные адреса отбрасываются', async () => {
    answerAll()
    await directNodes()
    await vi.waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bastyon_direct_nodes') ?? '{}')
      expect(stored.learned).toEqual(['8.8.4.4'])
    })
    learnNodes(['8.8.4.4', '1.1.1.1', SEEDS[0]!], 'proxy')
    const stored = JSON.parse(localStorage.getItem('bastyon_direct_nodes') ?? '{}')
    expect(stored.learned).toEqual(['1.1.1.1', '8.8.4.4'])
  })
})
