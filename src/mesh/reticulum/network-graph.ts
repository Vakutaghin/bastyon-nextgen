/**
 * Обзор сети Reticulum: таблица путей узла → граф. Раскладка по кольцам: в
 * центре свой узел, вокруг — интерфейсы, дальше адреса на кольце по числу
 * прыжков. Путь больше чем в один прыжок идёт через следующий транспортный
 * узел — он стоит на первом кольце, между интерфейсом и адресом. Углы — по
 * секторам: у каждого адреса свой, интерфейс и транспортный узел — посреди
 * своих адресов. Раскладка без физики: одна и та же сеть рисуется одинаково.
 */

import type { RnsAspect, RnsInterface, RnsPath } from './rns-api'

export type NetNodeKind =
  | 'self'
  | 'interface'
  | 'transport'
  | 'delivery'
  | 'nomadnetwork'
  | 'propagation'
  | 'unknown'

export interface NetNode {
  id: string
  kind: NetNodeKind
  label: string
  x: number
  y: number
  /** Интерфейс — на связи ли; у остальных всегда true. */
  online: boolean
  hops: number
}

export interface NetEdge {
  from: string
  to: string
}

export interface NetGraph {
  nodes: NetNode[]
  edges: NetEdge[]
  /** Радиус внешнего кольца: для viewBox. */
  radius: number
  /** Сколько путей не показано (граф — только ближние). */
  hidden: number
}

/** Кто это по announce: имя, аспект, identity (им назван транспортный узел). */
export interface NetPeer {
  dest: string
  identity: string
  name: string | null
  aspect: RnsAspect
}

export interface NetInterface {
  name: string
  kind: RnsInterface['kind']
  online: boolean
}

/** Радиусы колец: интерфейсы и шаг на прыжок. */
export const RING_INTERFACE = 70
export const RING_STEP = 64
/** Дальше этого кольца адреса не отодвигаются: «4+». */
export const MAX_RING_HOPS = 4
/** Сколько адресов рисовать: остальное — в таблице. */
export const MAX_GRAPH_NODES = 120

export const ASPECT_KIND: Record<RnsAspect, NetNodeKind> = {
  'lxmf.delivery': 'delivery',
  'nomadnetwork.node': 'nomadnetwork',
  'lxmf.propagation': 'propagation',
}

function short(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function ringOf(hops: number): number {
  return RING_INTERFACE + RING_STEP * Math.min(Math.max(hops, 1), MAX_RING_HOPS)
}

function polar(r: number, angle: number): { x: number; y: number } {
  // Округление — чтобы одинаковые сети давали одинаковую разметку.
  return {
    x: Math.round(r * Math.cos(angle) * 10) / 10,
    y: Math.round(r * Math.sin(angle) * 10) / 10,
  }
}

/** Средний угол группы (по кругу, без скачка через ±π). */
function meanAngle(angles: number[]): number {
  const x = angles.reduce((s, a) => s + Math.cos(a), 0)
  const y = angles.reduce((s, a) => s + Math.sin(a), 0)
  return Math.atan2(y, x)
}

export function buildNetGraph(
  paths: RnsPath[],
  peers: NetPeer[],
  interfaces: NetInterface[],
  selfLabel: string
): NetGraph {
  const byDest = new Map(peers.map((p) => [p.dest, p]))
  const byIdentity = new Map<string, NetPeer>()
  for (const p of peers) if (!byIdentity.has(p.identity)) byIdentity.set(p.identity, p)

  // Ближние и свежие — в граф, остальное — только в таблицу.
  const shown = [...paths]
    .sort((a, b) => a.hops - b.hops || b.updated - a.updated || a.dest.localeCompare(b.dest))
    .slice(0, MAX_GRAPH_NODES)
  // Порядок по кругу: интерфейс → следующий узел → адрес.
  shown.sort(
    (a, b) =>
      a.interface.localeCompare(b.interface) ||
      (a.via ?? '').localeCompare(b.via ?? '') ||
      a.hops - b.hops ||
      a.dest.localeCompare(b.dest)
  )

  const nodes: NetNode[] = [
    { id: 'self', kind: 'self', label: short(selfLabel), x: 0, y: 0, online: true, hops: 0 },
  ]
  const edges: NetEdge[] = []

  /** Углы адресов за интерфейсом и за транспортным узлом. */
  const ifaceAngles = new Map<string, number[]>()
  const transports = new Map<string, { iface: string; via: string; angles: number[] }>()

  shown.forEach((p, i) => {
    // Начало — сверху, по часовой стрелке.
    const angle = (2 * Math.PI * i) / Math.max(shown.length, 1) - Math.PI / 2
    const peer = byDest.get(p.dest)
    nodes.push({
      id: `dest:${p.dest}`,
      kind: peer ? ASPECT_KIND[peer.aspect] : 'unknown',
      label: short(peer?.name || p.dest.slice(0, 8)),
      ...polar(ringOf(p.hops), angle),
      online: true,
      hops: p.hops,
    })
    const list = ifaceAngles.get(p.interface) ?? []
    list.push(angle)
    ifaceAngles.set(p.interface, list)
    if (p.via) {
      const id = `via:${p.interface}|${p.via}`
      const t = transports.get(id) ?? { iface: p.interface, via: p.via, angles: [] }
      t.angles.push(angle)
      transports.set(id, t)
      edges.push({ from: id, to: `dest:${p.dest}` })
    } else {
      edges.push({ from: `iface:${p.interface}`, to: `dest:${p.dest}` })
    }
  })

  // Интерфейсы: настроенные (даже без путей) и те, что встретились в путях.
  const known = new Map(interfaces.map((i) => [i.name, i]))
  const ifaceNames = [
    ...interfaces.map((i) => i.name),
    ...shown.map((p) => p.interface).filter((n) => !known.has(n)),
  ].filter((n, i, all) => all.indexOf(n) === i)
  ifaceNames.forEach((name, i) => {
    const id = `iface:${name}`
    const own = ifaceAngles.get(name)
    const angle = own
      ? meanAngle(own)
      : (2 * Math.PI * i) / Math.max(ifaceNames.length, 1) - Math.PI / 2
    nodes.push({
      id,
      kind: 'interface',
      label: short(name || '?'),
      ...polar(RING_INTERFACE, angle),
      online: known.get(name)?.online ?? true,
      hops: 0,
    })
    edges.push({ from: 'self', to: id })
  })

  // Транспортные узлы — на первом кольце, посреди своих адресов.
  for (const [id, t] of transports) {
    nodes.push({
      id,
      kind: 'transport',
      label: short(byIdentity.get(t.via)?.name || t.via.slice(0, 8)),
      ...polar(ringOf(1), meanAngle(t.angles)),
      online: true,
      hops: 1,
    })
    edges.push({ from: `iface:${t.iface}`, to: id })
  }

  const deepest = shown.reduce((m, p) => Math.max(m, Math.min(p.hops, MAX_RING_HOPS)), 1)
  return {
    nodes,
    edges,
    radius: ringOf(deepest),
    hidden: paths.length - shown.length,
  }
}
