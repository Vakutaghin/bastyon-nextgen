/**
 * Из чего состоит схема сети: вы → прокси Bastyon → ноды, которые принимают
 * подключения → ноды за роутером. Здесь только состав и связи; раскладку и
 * рисование делает компонент схемы.
 */

import { linkEnds, type NetworkSnapshot, type ProxyState } from './network-snapshot'
import type { NodeRow } from './network-stats'

export type TopoKind = 'me' | 'proxy' | 'node'

/** Кольцо схемы: 0 — вы, 1 — прокси, 2 — принимают подключения, 3 — за роутером. */
export type TopoTier = 0 | 1 | 2 | 3

export interface TopoNodeSpec {
  id: string
  kind: TopoKind
  tier: TopoTier
  /** Подпись: «1 · 2» у прокси, адрес у ноды. */
  label: string
  row?: NodeRow
  /** Все имена сервера прокси: `1.pocketnet.app` и `2.pocketnet.app` бывают одним. */
  proxies?: ProxyState[]
}

export type TopoLinkKind = 'access' | 'pool' | 'p2p'

export interface TopoLinkSpec {
  key: string
  source: string
  target: string
  kind: TopoLinkKind
}

export const ME_ID = 'me'

export function proxyNodeId(host: string): string {
  return `proxy:${host}`
}

/** `1.pocketnet.app` → `1`. */
export function proxyShortName(host: string): string {
  return host.replace(/\.pocketnet\.app$/, '')
}

/** Какой узел схемы — прокси с этим именем (у одного сервера их бывает два). */
export function proxyIdByHost(proxies: ProxyState[]): Map<string, string> {
  const byHost = new Map<string, string>()
  for (const proxy of proxies) {
    byHost.set(proxy.host, proxyNodeId(proxy.sameAs ?? proxy.host))
  }
  return byHost
}

export function buildTopology(
  snapshot: NetworkSnapshot,
  rows: NodeRow[]
): { nodes: TopoNodeSpec[]; links: TopoLinkSpec[] } {
  const nodes: TopoNodeSpec[] = [{ id: ME_ID, kind: 'me', tier: 0, label: '' }]
  const links: TopoLinkSpec[] = []

  const servers = new Map<string, ProxyState[]>()
  for (const proxy of snapshot.proxies) {
    const id = proxyNodeId(proxy.sameAs ?? proxy.host)
    servers.set(id, [...(servers.get(id) ?? []), proxy])
  }
  for (const [id, names] of servers) {
    nodes.push({
      id,
      kind: 'proxy',
      tier: 1,
      label: names.map((p) => proxyShortName(p.host)).join(' · '),
      proxies: names,
    })
    links.push({ key: `${ME_ID}>${id}`, source: ME_ID, target: id, kind: 'access' })
  }

  const rowByIp = new Map(rows.map((row) => [row.ip, row]))
  for (const row of rows) {
    nodes.push({ id: row.ip, kind: 'node', tier: row.listening ? 2 : 3, label: row.ip, row })
  }
  for (const [id, names] of servers) {
    const seen = new Set<string>()
    for (const proxy of names) {
      if (!proxy.ok) continue
      for (const pooled of proxy.pool) {
        if (seen.has(pooled.ip)) continue
        seen.add(pooled.ip)
        if (!rowByIp.has(pooled.ip)) {
          // Нода на самом прокси (127.0.0.1) или та, до которой обход не дошёл.
          const row: NodeRow = {
            ip: pooled.ip,
            version: pooled.version,
            listening: true,
            answered: false,
            sync: 'unknown',
            forked: false,
            kind: 'unknown',
            degree: 0,
            proxies: [proxy.host],
            users: pooled.users,
            successPercent: pooled.successPercent,
            avgMs: pooled.avgMs,
          }
          rowByIp.set(pooled.ip, row)
          nodes.push({ id: pooled.ip, kind: 'node', tier: 2, label: pooled.ip, row })
        }
        links.push({ key: `${id}>${pooled.ip}`, source: id, target: pooled.ip, kind: 'pool' })
      }
    }
  }

  for (const key of snapshot.links.keys()) {
    const [a, b] = linkEnds(key)
    if (rowByIp.has(a) && rowByIp.has(b)) links.push({ key, source: a, target: b, kind: 'p2p' })
  }
  return { nodes, links }
}
