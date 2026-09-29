// Обзор сети Reticulum: таблица путей → граф по кольцам (свой узел, интерфейсы,
// транспортные узлы, адреса по числу прыжков).

import { describe, expect, it } from 'vitest'

import {
  buildNetGraph,
  MAX_GRAPH_NODES,
  RING_INTERFACE,
  RING_STEP,
  type NetGraph,
} from './network-graph'
import type { RnsPath } from './rns-api'

const HUB = 'hub.example:4242'

function path(dest: string, hops: number, over = HUB, via: string | null = null): RnsPath {
  return {
    dest,
    hops,
    via,
    interface: over,
    kind: over === 'LAN' ? 'auto' : 'tcp',
    updated: 1000,
    expires: 2000,
  }
}

const node = (g: NetGraph, id: string) => g.nodes.find((n) => n.id === id)!
const dist = (g: NetGraph, id: string) => Math.round(Math.hypot(node(g, id).x, node(g, id).y))
const has = (g: NetGraph, from: string, to: string) =>
  g.edges.some((e) => e.from === from && e.to === to)

describe('network graph', () => {
  const peers = [
    {
      dest: 'aa'.repeat(16),
      identity: '01'.repeat(16),
      name: 'Алиса',
      aspect: 'lxmf.delivery' as const,
    },
    {
      dest: 'bb'.repeat(16),
      identity: 'f0'.repeat(16),
      name: 'Доска района',
      aspect: 'nomadnetwork.node' as const,
    },
    {
      dest: 'cc'.repeat(16),
      identity: 'f0'.repeat(16),
      name: 'Узел доставки',
      aspect: 'lxmf.propagation' as const,
    },
  ]
  const interfaces = [
    { name: HUB, kind: 'tcp' as const, online: true },
    { name: 'LAN', kind: 'auto' as const, online: false },
  ]

  it('puts direct paths on the first ring and far ones behind their next hop', () => {
    const g = buildNetGraph(
      [
        path('aa'.repeat(16), 1, 'LAN'),
        path('bb'.repeat(16), 1),
        path('dd'.repeat(16), 3, HUB, 'f0'.repeat(16)),
        path('ee'.repeat(16), 7, HUB, 'f0'.repeat(16)),
      ],
      peers,
      interfaces,
      'Я'
    )
    expect(node(g, 'self')).toMatchObject({ x: 0, y: 0, label: 'Я' })
    expect(dist(g, `iface:${HUB}`)).toBe(RING_INTERFACE)
    expect(node(g, 'iface:LAN').online).toBe(false)
    expect(has(g, 'self', `iface:${HUB}`) && has(g, 'self', 'iface:LAN')).toBe(true)

    // Прямые — на первом кольце от своего интерфейса, с именем из announce.
    expect(node(g, `dest:${'aa'.repeat(16)}`)).toMatchObject({ kind: 'delivery', label: 'Алиса' })
    expect(dist(g, `dest:${'aa'.repeat(16)}`)).toBe(RING_INTERFACE + RING_STEP)
    expect(has(g, 'iface:LAN', `dest:${'aa'.repeat(16)}`)).toBe(true)
    expect(node(g, `dest:${'bb'.repeat(16)}`).kind).toBe('nomadnetwork')

    // Дальние — через транспортный узел; он назван по identity из announce.
    const via = `via:${HUB}|${'f0'.repeat(16)}`
    expect(node(g, via)).toMatchObject({ kind: 'transport', label: 'Доска района' })
    expect(dist(g, via)).toBe(RING_INTERFACE + RING_STEP)
    expect(has(g, `iface:${HUB}`, via) && has(g, via, `dest:${'dd'.repeat(16)}`)).toBe(true)
    expect(dist(g, `dest:${'dd'.repeat(16)}`)).toBe(RING_INTERFACE + 3 * RING_STEP)
    // Дальше четвёртого кольца не уходит; незнакомый адрес — по хэшу.
    expect(dist(g, `dest:${'ee'.repeat(16)}`)).toBe(RING_INTERFACE + 4 * RING_STEP)
    expect(node(g, `dest:${'ee'.repeat(16)}`)).toMatchObject({ kind: 'unknown', label: 'eeeeeeee' })
    expect(g.radius).toBe(RING_INTERFACE + 4 * RING_STEP)
    expect(g.hidden).toBe(0)
  })

  it('draws the same network the same way', () => {
    const paths = [path('aa'.repeat(16), 1), path('dd'.repeat(16), 2, HUB, 'f0'.repeat(16))]
    const a = buildNetGraph(paths, peers, interfaces, 'Я')
    const b = buildNetGraph([...paths].reverse(), peers, interfaces, 'Я')
    expect(b).toEqual(a)
  })

  it('keeps the nearest paths in the graph and counts the rest', () => {
    const many = Array.from({ length: MAX_GRAPH_NODES + 5 }, (_, i) =>
      path(i.toString(16).padStart(32, '0'), i < 10 ? 1 : 5, HUB, i < 10 ? null : 'f0'.repeat(16))
    )
    const g = buildNetGraph(many, [], interfaces, 'Я')
    expect(g.hidden).toBe(5)
    expect(g.nodes.filter((n) => n.id.startsWith('dest:'))).toHaveLength(MAX_GRAPH_NODES)
    // Все прямые попали в граф.
    for (let i = 0; i < 10; i++) {
      expect(g.nodes.some((n) => n.id === `dest:${i.toString(16).padStart(32, '0')}`)).toBe(true)
    }
  })

  it('shows configured interfaces even without paths', () => {
    const g = buildNetGraph([], [], interfaces, 'Я')
    expect(g.nodes.map((n) => n.id)).toEqual(['self', `iface:${HUB}`, 'iface:LAN'])
    expect(g.radius).toBe(RING_INTERFACE + RING_STEP)
  })
})
