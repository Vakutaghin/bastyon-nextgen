// Состав схемы: вы → прокси (два имени одного сервера — один узел) → ноды
// пула → остальные ноды; нода на самом прокси — отдельная точка у прокси.

import { describe, expect, it } from 'vitest'
import { emptySnapshot, linkKey } from './network-snapshot'
import { buildNodeRows } from './network-stats'
import { buildTopology, ME_ID, proxyIdByHost, proxyNodeId } from './topology-model'

describe('buildTopology', () => {
  it('прокси одного сервера — один узел, пулы — связи, ноды — по кольцам', () => {
    const snap = emptySnapshot()
    snap.nodes.set('a', { ip: 'a', listening: true, answered: true })
    snap.nodes.set('n', { ip: 'n', listening: false, answered: false })
    snap.links.set(linkKey('a', 'n'), {})
    snap.proxies = [
      { host: '1.pocketnet.app', port: 8899, ok: true, pool: [{ ip: 'a', users: 1, fork: false }] },
      {
        host: '2.pocketnet.app',
        port: 8899,
        ok: true,
        sameAs: '1.pocketnet.app',
        pool: [{ ip: 'a', users: 1, fork: false }],
      },
      {
        host: '3.pocketnet.app',
        port: 8899,
        ok: true,
        pool: [{ ip: 'local@3.pocketnet.app', users: 2, fork: false }],
      },
      { host: '4.pocketnet.app', port: 8899, ok: false, pool: [] },
    ]
    const { nodes, links } = buildTopology(snap, buildNodeRows(snap))

    const one = proxyNodeId('1.pocketnet.app')
    expect(nodes.map((n) => [n.id, n.tier])).toEqual([
      [ME_ID, 0],
      [one, 1],
      [proxyNodeId('3.pocketnet.app'), 1],
      [proxyNodeId('4.pocketnet.app'), 1],
      ['a', 2],
      ['n', 3],
      ['local@3.pocketnet.app', 2],
    ])
    expect(nodes.find((n) => n.id === one)?.label).toBe('1 · 2')
    expect(links.map((l) => `${l.kind}:${l.source}>${l.target}`)).toEqual([
      `access:${ME_ID}>${one}`,
      `access:${ME_ID}>${proxyNodeId('3.pocketnet.app')}`,
      `access:${ME_ID}>${proxyNodeId('4.pocketnet.app')}`,
      `pool:${one}>a`,
      `pool:${proxyNodeId('3.pocketnet.app')}>local@3.pocketnet.app`,
      'p2p:a>n',
    ])
    expect(proxyIdByHost(snap.proxies).get('2.pocketnet.app')).toBe(one)
  })
})
