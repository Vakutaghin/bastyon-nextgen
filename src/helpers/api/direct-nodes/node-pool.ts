/**
 * Какие ноды спрашивать напрямую. Список — зашитые в приложение ноды с
 * TLS (servers.json → nodes.seeds) плюс узнанные по ходу: у прокси, пока он
 * доступен, и у самих нод (`getpeerinfo`). Ноды опрашиваются `getnodeinfo`
 * по нескольку разом; хватило трёх согласных — выбор закончен.
 *
 * Высоте одной ноды не верим: годятся ноды не дальше двух блоков от высоты,
 * которую подтвердили хотя бы две. На одной высоте у всех должен быть один
 * хэш блока — нода с другим (форк или подделка) отбрасывается. Рабочие ноды
 * — по скорости ответа; запросы идут к первой, остальные — запасные.
 */

import servers from '@/servers.json'
import { connectionState } from './connection-state'
import { nodeCall } from './node-call'
import { NodePinMismatchError } from './native-link'

const SEEDS: readonly string[] = servers.servers.production.nodes.seeds
const STORAGE_KEY = 'bastyon_direct_nodes'

const PROBE_TIMEOUT_MS = 6_000
const CONCURRENCY = 8
/** Столько согласных нод достаточно, чтобы закончить выбор. */
const ENOUGH = 3
/** Ждём ещё немного после ENOUGH: вдруг ответит нода быстрее. */
const GRACE_MS = 300
/** Сколько нод держать в работе. */
const WORKING = 5
const WORKING_TTL_MS = 10 * 60_000
/** Насколько нода может отставать по блокам. */
const MAX_LAG = 2
/** Не спрашивать заново ноду, которая только что не ответила. */
const FAILED_TTL_MS = 10 * 60_000
const MAX_LEARNED = 300
const PEERS_EVERY_MS = 60 * 60_000

export interface NodeProbe {
  host: string
  height: number
  hash: string
  ms: number
}

interface Stored {
  /** Рабочие ноды прошлого выбора — их спрашиваем первыми. */
  good: string[]
  /** Узнанные у прокси и у нод. */
  learned: string[]
  peersAt: number
  proxyAt: number
}

function readStored(): Stored {
  const empty: Stored = { good: [], learned: [], peersAt: 0, proxyAt: 0 }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : null
    if (!parsed || typeof parsed !== 'object') return empty
    const list = (v: unknown) =>
      Array.isArray(v) ? v.filter((h): h is string => typeof h === 'string') : []
    return {
      good: list(parsed.good),
      learned: list(parsed.learned),
      peersAt: Number(parsed.peersAt) || 0,
      proxyAt: Number(parsed.proxyAt) || 0,
    }
  } catch {
    return empty
  }
}

function writeStored(patch: Partial<Stored>): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...patch }))
  } catch {
    // хранилище недоступно — в следующий раз начнём с зашитого списка
  }
}

/** Публичный IPv4: частные, служебные и IPv6 ноды напрямую не спрашиваем. */
export function isPublicIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if ([m[1], m[2], m[3], m[4]].some((p) => Number(p) > 255)) return false
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  return true
}

/** Добавить узнанные ноды (из `getpeerinfo` или списка прокси). */
export function learnNodes(hosts: readonly string[], source: 'peers' | 'proxy', now = Date.now()) {
  const stored = readStored()
  const known = new Set([...SEEDS, ...stored.learned])
  const fresh = hosts.filter((h) => isPublicIpv4(h) && !known.has(h))
  const learned = [...fresh, ...stored.learned].slice(0, MAX_LEARNED)
  writeStored(source === 'peers' ? { learned, peersAt: now } : { learned, proxyAt: now })
}

/** Пора ли снова спросить у прокси его список нод. */
export function shouldLearnFromProxy(now = Date.now()): boolean {
  return now - readStored().proxyAt > 7 * 24 * 3600 * 1000
}

/**
 * Высота, которую подтвердили хотя бы две ноды, и ноды рядом с ней — по
 * скорости. Одна ответившая нода годится сама: сверить её не с кем.
 */
export function agreeingNodes(probes: readonly NodeProbe[]): NodeProbe[] {
  if (probes.length <= 1) return [...probes]
  const heights = [...new Set(probes.map((p) => p.height))].sort((a, b) => b - a)
  const near = (h: number) => probes.filter((p) => Math.abs(p.height - h) <= MAX_LAG)
  const top = heights.find((h) => near(h).length >= 2) ?? heights[0]!
  let good = near(top).filter((p) => p.height <= top)
  // На одной высоте хэш блока один: меньшинство с другим хэшем — не та цепочка.
  const atTop = good.filter((p) => p.height === top)
  const votes = new Map<string, number>()
  for (const p of atTop) votes.set(p.hash, (votes.get(p.hash) ?? 0) + 1)
  if (votes.size > 1) {
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    good = good.filter((p) => p.height !== top || p.hash === best)
  }
  return good.sort((a, b) => a.ms - b.ms)
}

let working: { hosts: string[]; at: number } | null = null
let selecting: Promise<string[]> | null = null
const failedAt = new Map<string, number>()
/** Ноды, сменившие сертификат: до перезапуска не спрашиваем. */
const rejected = new Set<string>()

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function candidates(now: number): string[] {
  const stored = readStored()
  const usable = (h: string) =>
    !rejected.has(h) && now - (failedAt.get(h) ?? 0) > FAILED_TTL_MS && isPublicIpv4(h)
  const first = stored.good.filter(usable)
  const rest = shuffled([...SEEDS, ...stored.learned]).filter(
    (h) => usable(h) && !first.includes(h)
  )
  return [...new Set([...first, ...rest])]
}

async function probe(host: string, signal: AbortSignal): Promise<NodeProbe | null> {
  const startedAt = Date.now()
  try {
    const info = (await nodeCall(host, 'getnodeinfo', [], {
      timeoutMs: PROBE_TIMEOUT_MS,
      signal,
    })) as { chain?: unknown; lastblock?: { height?: unknown; hash?: unknown } } | null
    const height = Number(info?.lastblock?.height)
    const hash = info?.lastblock?.hash
    if (info?.chain !== 'main' || !Number.isFinite(height) || typeof hash !== 'string') {
      failedAt.set(host, Date.now())
      return null
    }
    return { host, height, hash, ms: Date.now() - startedAt }
  } catch (error) {
    if (signal.aborted) return null
    if (error instanceof NodePinMismatchError) rejected.add(host)
    else failedAt.set(host, Date.now())
    return null
  }
}

async function select(): Promise<string[]> {
  const list = candidates(Date.now())
  const probes: NodeProbe[] = []
  const stop = new AbortController()
  connectionState.selecting = true
  try {
    await new Promise<void>((resolve) => {
      let next = 0
      let active = 0
      let grace: ReturnType<typeof setTimeout> | null = null
      const finish = () => {
        if (grace) clearTimeout(grace)
        stop.abort()
        resolve()
      }
      const launch = () => {
        while (!stop.signal.aborted && active < CONCURRENCY && next < list.length) {
          const host = list[next++]!
          active++
          void probe(host, stop.signal).then((p) => {
            active--
            if (stop.signal.aborted) return
            if (p) probes.push(p)
            if (!grace && agreeingNodes(probes).length >= ENOUGH) {
              grace = setTimeout(finish, GRACE_MS)
            }
            // Согласных хватает — новых не спрашиваем, ждём уже спрошенных.
            if (active === 0 && (grace || next >= list.length)) finish()
            else if (!grace) launch()
          })
        }
        if (!stop.signal.aborted && next >= list.length && active === 0) finish()
      }
      launch()
    })
  } finally {
    connectionState.selecting = false
  }

  const hosts = agreeingNodes(probes)
    .slice(0, WORKING)
    .map((p) => p.host)
  connectionState.selectFailed = !hosts.length
  if (!hosts.length) throw new Error('No Pocketnet nodes answered directly')
  working = { hosts, at: Date.now() }
  writeStored({ good: hosts })
  publish()
  void learnFromPeers(hosts[0]!)
  return hosts
}

function publish(): void {
  connectionState.nodes = working?.hosts.length ?? 0
  connectionState.node = working?.hosts[0] ?? null
}

/** Соседи ноды — ещё ноды для списка; не чаще раза в час. */
async function learnFromPeers(host: string, now = Date.now()): Promise<void> {
  if (now - readStored().peersAt < PEERS_EVERY_MS) return
  try {
    const peers = (await nodeCall(host, 'getpeerinfo', [], { timeoutMs: 15_000 })) as Array<{
      addr?: unknown
    }> | null
    const hosts = (Array.isArray(peers) ? peers : [])
      .map((p) => (typeof p?.addr === 'string' ? p.addr.replace(/:\d+$/, '') : ''))
      .filter(Boolean)
    learnNodes(hosts, 'peers', now)
  } catch {
    // в другой раз
  }
}

/** Рабочие ноды, лучшая первой; при необходимости выбирает заново. */
export function directNodes(): Promise<string[]> {
  if (working && working.hosts.length && Date.now() - working.at < WORKING_TTL_MS) {
    return Promise.resolve([...working.hosts])
  }
  selecting ??= select().finally(() => {
    selecting = null
  })
  return selecting
}

/** Нода не ответила: убрать из рабочих, а кончились — выбрать заново. */
export function markNodeDead(host: string): void {
  failedAt.set(host, Date.now())
  if (!working) return
  working = { ...working, hosts: working.hosts.filter((h) => h !== host) }
  if (!working.hosts.length) working = null
  publish()
}

/** Нода сменила сертификат: не спрашивать до перезапуска. */
export function markNodeRejected(host: string): void {
  rejected.add(host)
  markNodeDead(host)
}

/** Сброс для тестов. */
export function resetDirectNodesForTests(): void {
  working = null
  selecting = null
  failedAt.clear()
  rejected.clear()
  publish()
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // нечего сбрасывать
  }
}
