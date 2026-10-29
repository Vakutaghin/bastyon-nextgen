// Карта сети: что даёт ответ ноды о соседях и о себе, кто на чужой ветке,
// какой тип у ноды и что карта переживает сохранение.

import { describe, expect, it } from 'vitest'
import type { PeerInfo } from '@/types/rpc-responses/get-peer-info'
import {
  applyNodeInfo,
  applyPeers,
  coreVersion,
  degreeMap,
  deserializeSnapshot,
  emptySnapshot,
  forkedNodes,
  linkKey,
  nodeIp,
  nodeKind,
  serializeSnapshot,
  syncState,
  tipHeight,
} from './network-snapshot'

function peer(addr: string, extra: Partial<PeerInfo> = {}): PeerInfo {
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
    inbound: false,
    whitelisted: false,
    banscore: 0,
    startingheight: 4_000_000,
    synced_headers: 4_083_000,
    synced_blocks: 4_083_000,
    ...extra,
  }
}

describe('адреса и версии', () => {
  it('адрес — без порта, IPv6 — без скобок; нода на самом прокси своя у каждого прокси', () => {
    expect(nodeIp('1.2.3.4:37070')).toBe('1.2.3.4')
    expect(nodeIp('[2a01:4f8::1]:37070')).toBe('2a01:4f8::1')
    expect(nodeIp('127.0.0.1:38081', '3.pocketnet.app')).toBe('local@3.pocketnet.app')
  })

  it('версия из рукопожатия — только номер', () => {
    expect(coreVersion('/Satoshi:0.22.21/')).toBe('0.22.21')
    expect(coreVersion('0.22.20')).toBe('0.22.20')
    expect(coreVersion('/Unknown/')).toBeUndefined()
  })
})

describe('applyPeers', () => {
  it('соседи становятся нодами, связи — с пингом, временем и тем, кто подключился', () => {
    const snap = emptySnapshot()
    const listening = applyPeers(snap, '10.0.0.1', [
      peer('10.0.0.2:37070', { pingtime: 0.042, conntime: 1_791_000_000 }),
      peer('10.0.0.3:51234', { inbound: true, synced_blocks: 4_082_900 }),
    ])

    expect(listening).toEqual(['10.0.0.2'])
    expect(snap.nodes.get('10.0.0.1')).toMatchObject({ answered: true, listening: true })
    expect(snap.nodes.get('10.0.0.2')).toMatchObject({ listening: true, answered: false })
    // К опрошенной подключилась сама — значит, сидит за роутером.
    expect(snap.nodes.get('10.0.0.3')).toMatchObject({ listening: false, height: 4_082_900 })
    expect(snap.links.get(linkKey('10.0.0.1', '10.0.0.2'))).toEqual({
      from: '10.0.0.1',
      pingMs: 42,
      since: 1_791_000_000,
    })
    expect(snap.links.get(linkKey('10.0.0.1', '10.0.0.3'))?.from).toBe('10.0.0.3')
    expect(degreeMap(snap).get('10.0.0.1')).toBe(2)
  })

  it('флаги рукопожатия: полная нода или облегчённая (только свежие блоки)', () => {
    const snap = emptySnapshot()
    applyPeers(snap, '10.0.0.1', [
      peer('10.0.0.2:37070'),
      peer('10.0.0.3:37070', { services: '0000000000000408' }),
    ])
    expect(nodeKind(snap.nodes.get('10.0.0.2')!)).toBe('full')
    expect(nodeKind(snap.nodes.get('10.0.0.3')!)).toBe('pruned')
    expect(nodeKind({ ip: 'x', listening: false, answered: false })).toBe('unknown')
  })

  it('в сети «не меньше» — по самому старому соединению из всех, что видели соседи', () => {
    const snap = emptySnapshot()
    applyPeers(snap, '10.0.0.1', [peer('10.0.0.9:37070', { conntime: 1_792_000_000 })])
    applyPeers(snap, '10.0.0.2', [peer('10.0.0.9:37070', { conntime: 1_780_000_000 })])
    applyPeers(snap, '10.0.0.3', [peer('10.0.0.9:37070', { conntime: 1_790_000_000 })])
    expect(snap.nodes.get('10.0.0.9')!.onlineSince).toBe(1_780_000_000)
  })

  it('ответившая нода сама знает версию и высоту — соседи их не перебивают', () => {
    const snap = emptySnapshot()
    applyNodeInfo(snap, '10.0.0.2', {
      version: '0.22.21',
      lastblock: { height: 4_083_500, hash: 'aa' },
    })
    snap.nodes.get('10.0.0.2')!.answered = true
    applyPeers(snap, '10.0.0.1', [
      peer('10.0.0.2:37070', { version: '/Satoshi:0.22.20/', synced_blocks: 4_000 }),
    ])
    expect(snap.nodes.get('10.0.0.2')).toMatchObject({
      version: '0.22.21',
      height: 4_083_500,
      tipHash: 'aa',
    })
  })
})

describe('состояние нод', () => {
  it('высота сети — наибольшая; отстала больше чем на 3 блока — «отстаёт»', () => {
    const snap = emptySnapshot()
    applyNodeInfo(snap, 'a', { lastblock: { height: 100 } })
    applyNodeInfo(snap, 'b', { lastblock: { height: 97 } })
    applyNodeInfo(snap, 'c', { lastblock: { height: 90 } })
    const tip = tipHeight(snap)
    expect(tip).toBe(100)
    expect(syncState(snap.nodes.get('b')!, tip)).toBe('synced')
    expect(syncState(snap.nodes.get('c')!, tip)).toBe('behind')
    expect(syncState({ ip: 'd', listening: false, answered: false }, tip)).toBe('unknown')
  })

  it('на той же высоте другой последний блок, чем у большинства, — чужая ветка', () => {
    const snap = emptySnapshot()
    applyNodeInfo(snap, 'a', { lastblock: { height: 100, hash: 'main' } })
    applyNodeInfo(snap, 'b', { lastblock: { height: 100, hash: 'main' } })
    applyNodeInfo(snap, 'c', { lastblock: { height: 100, hash: 'fork' } })
    applyNodeInfo(snap, 'd', { lastblock: { height: 99, hash: 'other' } })
    expect([...forkedNodes(snap)]).toEqual(['c'])
  })
})

describe('сохранение', () => {
  it('карта переживает сохранение целиком: ноды, связи, прокси', () => {
    const snap = emptySnapshot()
    applyPeers(snap, '10.0.0.1', [
      peer('10.0.0.2:37070', { pingtime: 0.01 }),
      peer('10.0.0.3:5555', { inbound: true }),
    ])
    applyNodeInfo(snap, '10.0.0.1', { version: '0.22.21', lastblock: { height: 5, hash: 'h' } })
    snap.nodes.get('10.0.0.2')!.country = 'DE'
    snap.nodes.get('10.0.0.3')!.country = null
    snap.proxies = [{ host: '1.pocketnet.app', port: 8899, ok: true, pool: [], clients: 7 }]
    snap.takenAt = 1000
    snap.durationMs = 20
    snap.asked = 3
    snap.answered = 1

    const back = deserializeSnapshot(serializeSnapshot(snap))!
    expect(back.nodes).toEqual(snap.nodes)
    expect(back.links).toEqual(snap.links)
    expect(back.proxies).toEqual(snap.proxies)
    expect(back).toMatchObject({ takenAt: 1000, durationMs: 20, asked: 3, answered: 1 })
  })

  it('мусор и прежний формат — карты нет, а не ошибка', () => {
    expect(deserializeSnapshot(null)).toBeNull()
    expect(deserializeSnapshot('{oops')).toBeNull()
    expect(deserializeSnapshot('{"v":1,"nodes":[],"links":[]}')).toBeNull()
  })
})
