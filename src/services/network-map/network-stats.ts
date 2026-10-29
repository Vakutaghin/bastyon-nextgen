/**
 * Цифры вкладки «Сеть»: строки таблицы нод, версии, страны и итоги для
 * карточек сверху. Всё — из снимка карты, без запросов.
 */

import {
  degreeMap,
  forkedNodes,
  nodeKind,
  syncState,
  tipHeight,
  type NetworkSnapshot,
  type NodeKind,
  type SyncState,
} from './network-snapshot'

export interface NodeRow {
  ip: string
  /** ISO-код; null — неизвестна; undefined — ещё не определяли. */
  country?: string | null
  version?: string
  listening: boolean
  answered: boolean
  height?: number
  /** Сколько блоков не хватает до высоты сети. */
  lag?: number
  sync: SyncState
  /** На чужой ветке: на той же высоте другой последний блок. */
  forked: boolean
  kind: NodeKind
  onlineSince?: number
  clockOffset?: number
  degree: number
  /** Прокси, у которых нода в пуле. */
  proxies: string[]
  /** Сколько приложений держат через неё соединение — по всем прокси. */
  users: number
  successPercent?: number
  avgMs?: number
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

export function buildNodeRows(snapshot: NetworkSnapshot): NodeRow[] {
  const tip = tipHeight(snapshot)
  const degree = degreeMap(snapshot)
  const forked = forkedNodes(snapshot)
  const pools = new Map<
    string,
    { proxies: string[]; users: number; successPercent?: number; avgMs?: number }
  >()
  for (const proxy of snapshot.proxies) {
    for (const node of proxy.pool) {
      const entry = pools.get(node.ip) ?? { proxies: [], users: 0 }
      entry.proxies.push(proxy.host)
      entry.users += node.users
      if (node.successPercent !== undefined) entry.successPercent = node.successPercent
      if (node.avgMs !== undefined) entry.avgMs = node.avgMs
      pools.set(node.ip, entry)
    }
  }
  const rows: NodeRow[] = []
  for (const node of snapshot.nodes.values()) {
    const pool = pools.get(node.ip)
    rows.push({
      ip: node.ip,
      country: node.country,
      version: node.version,
      listening: node.listening,
      answered: node.answered,
      height: node.height,
      lag: node.height && tip ? Math.max(0, tip - node.height) : undefined,
      sync: syncState(node, tip),
      forked: forked.has(node.ip),
      kind: nodeKind(node),
      onlineSince: node.onlineSince,
      clockOffset: node.clockOffset,
      degree: degree.get(node.ip) ?? 0,
      proxies: pool?.proxies ?? [],
      users: pool?.users ?? 0,
      successPercent: pool?.successPercent,
      avgMs: pool?.avgMs,
    })
  }
  return rows
}

export interface CountShare<K> {
  key: K
  count: number
  share: number
}

function shares<K>(counts: Map<K, number>, total: number): CountShare<K>[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
}

/** Страны по числу нод; неизвестные — отдельно, в конце не участвуют. */
export function countryShares(rows: NodeRow[]): { known: CountShare<string>[]; unknown: number } {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const row of rows) {
    if (row.country) counts.set(row.country, (counts.get(row.country) ?? 0) + 1)
    else unknown++
  }
  return { known: shares(counts, rows.length), unknown }
}

/** Версии по числу нод, свежая — первой. */
export function versionShares(rows: NodeRow[]): {
  versions: CountShare<string>[]
  latest?: string
  unknown: number
} {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const row of rows) {
    if (row.version) counts.set(row.version, (counts.get(row.version) ?? 0) + 1)
    else unknown++
  }
  const versions = shares(counts, rows.length - unknown).sort((a, b) =>
    compareVersions(b.key, a.key)
  )
  return { versions, latest: versions[0]?.key, unknown }
}

export interface NetworkTotals {
  nodes: number
  answered: number
  listening: number
  links: number
  countries: number
  synced: number
  behind: number
  forked: number
  full: number
  pruned: number
  /** Доля синхронизированных среди тех, чья высота известна. */
  syncedShare: number
  latest?: string
  onLatest: number
  /** Доля нод на свежей версии среди тех, чья версия известна. */
  latestShare: number
  tip: number
}

export function networkTotals(snapshot: NetworkSnapshot, rows: NodeRow[]): NetworkTotals {
  const { versions, latest } = versionShares(rows)
  const synced = rows.filter((r) => r.sync === 'synced').length
  const behind = rows.filter((r) => r.sync === 'behind').length
  const withVersion = versions.reduce((sum, v) => sum + v.count, 0)
  const onLatest = versions[0]?.count ?? 0
  return {
    nodes: rows.length,
    answered: rows.filter((r) => r.answered).length,
    listening: rows.filter((r) => r.listening).length,
    links: snapshot.links.size,
    countries: countryShares(rows).known.length,
    synced,
    behind,
    forked: rows.filter((r) => r.forked).length,
    full: rows.filter((r) => r.kind === 'full').length,
    pruned: rows.filter((r) => r.kind === 'pruned').length,
    syncedShare: synced + behind ? synced / (synced + behind) : 0,
    latest,
    onLatest,
    latestShare: withVersion ? onLatest / withVersion : 0,
    tip: tipHeight(snapshot),
  }
}
