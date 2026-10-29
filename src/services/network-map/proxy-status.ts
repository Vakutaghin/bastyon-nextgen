/**
 * Прокси Bastyon (`N.pocketnet.app`) для карты сети: жив ли, через какую ноду
 * отвечает сейчас (`/ping`), какие ноды у него в пуле и сколько приложений к
 * нему подключено (`/info` — та же сводка, что в разделе нод прежнего
 * приложения). Сводка весит 40–130 КБ, поэтому берётся только при обходе сети,
 * по кнопке.
 */

import { appFetch } from '@/helpers/api/request'
import { nodeIp, type PoolNode, type ProxyState } from './network-snapshot'

export interface ProxyEndpoint {
  host: string
  port: number
}

/** Живой прокси отвечает на /ping за доли секунды; мёртвого дольше не ждём. */
const PING_TIMEOUT_MS = 4_000
const INFO_TIMEOUT_MS = 10_000

async function getJson(
  url: string,
  init: RequestInit,
  timeout: number
): Promise<{ data: unknown; ms: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const startedAt = Date.now()
  try {
    const res = await appFetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { data?: unknown }
    return { data: json?.data, ms: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

interface RawPoolEntry {
  node?: { version?: string | null; wssusers?: number }
  statistic?: { percent?: number; time?: number }
  status?: { fork?: boolean; difference?: number }
  users?: number
}

interface RawInfo {
  info?: {
    nodeManager?: { count?: number; nodes?: Record<string, RawPoolEntry> }
    wss?: { clients?: number; users?: number }
    server?: { startedDate?: string; middle?: { rate?: number } }
  }
}

/** Сводка `/info`: пул нод, приложения онлайн, нагрузка. */
export function parseProxyInfo(
  host: string,
  raw: unknown
): Pick<ProxyState, 'known' | 'pool' | 'clients' | 'users' | 'rps' | 'startedAt'> {
  const info = (raw as RawInfo)?.info
  const manager = info?.nodeManager
  const pool: PoolNode[] = Object.entries(manager?.nodes ?? {}).map(([key, entry]) => ({
    ip: nodeIp(key, host),
    ...(entry.node?.version ? { version: entry.node.version } : {}),
    users: entry.users ?? entry.node?.wssusers ?? 0,
    ...(typeof entry.statistic?.percent === 'number'
      ? { successPercent: Math.round(entry.statistic.percent) }
      : {}),
    ...(entry.statistic?.time ? { avgMs: Math.round(entry.statistic.time) } : {}),
    ...(typeof entry.status?.difference === 'number' ? { lag: entry.status.difference } : {}),
    fork: entry.status?.fork === true,
  }))
  return {
    ...(typeof manager?.count === 'number' ? { known: manager.count } : {}),
    pool,
    ...(typeof info?.wss?.clients === 'number' ? { clients: info.wss.clients } : {}),
    ...(typeof info?.wss?.users === 'number' ? { users: info.wss.users } : {}),
    ...(typeof info?.server?.middle?.rate === 'number'
      ? { rps: Math.round(info.server.middle.rate * 10) / 10 }
      : {}),
    ...(info?.server?.startedDate ? { startedAt: info.server.startedDate } : {}),
  }
}

/**
 * `1.pocketnet.app` и `2.pocketnet.app` бывают одним сервером: тогда у них один
 * момент запуска. Второму ставим `sameAs`, чтобы не считать приложения дважды.
 */
export function markSameServers(proxies: ProxyState[]): void {
  const firstByStart = new Map<string, string>()
  for (const proxy of proxies) {
    if (!proxy.startedAt) continue
    const first = firstByStart.get(proxy.startedAt)
    if (first) proxy.sameAs = first
    else firstByStart.set(proxy.startedAt, proxy.host)
  }
}

/** Жив ли прокси и что у него в сводке. Без сводки — только /ping. */
export async function probeProxy(proxy: ProxyEndpoint, withInfo: boolean): Promise<ProxyState> {
  const base = `https://${proxy.host}:${proxy.port}`
  const state: ProxyState = { host: proxy.host, port: proxy.port, ok: false, pool: [] }
  try {
    const { data, ms } = await getJson(
      `${base}/ping`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: '{}',
      },
      PING_TIMEOUT_MS
    )
    const ping = data as { node?: string; height?: number } | undefined
    state.ok = true
    state.latencyMs = ms
    if (ping?.height) state.height = ping.height
    if (ping?.node) state.bestNode = nodeIp(ping.node, proxy.host)
  } catch {
    return state
  }
  if (!withInfo) return state
  try {
    const { data } = await getJson(`${base}/info`, { method: 'GET' }, INFO_TIMEOUT_MS)
    Object.assign(state, parseProxyInfo(proxy.host, data))
  } catch {
    // без сводки прокси всё равно годится для обхода
  }
  return state
}
