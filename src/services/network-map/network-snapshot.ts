/**
 * Карта сети нод — что собрал обход (network-crawler) и что видно на вкладке
 * «Сеть» «Блокчейн-обозревателя». Нода — IP-адрес: так её видят соседи.
 *
 * Отсюда же — как ноду показывать: принимает ли подключения, отстаёт ли.
 */

import type { PeerInfo } from '@/types/rpc-responses/get-peer-info'

export interface MapNode {
  ip: string
  /** К ней подключился кто-то из опрошенных — значит, она принимает подключения. */
  listening: boolean
  /** Ответила на опрос: рассказала, с кем соединена. */
  answered: boolean
  /** Версия ноды, `0.22.21`. */
  version?: string
  /** Высота: своя, если нода ответила, иначе наибольшая, что видели у неё соседи. */
  height?: number
  /** Хеш её последнего блока — если ответила; по нему видна чужая ветка. */
  tipHash?: string
  /** Флаги сервисов из рукопожатия (NODE_NETWORK и т. д.). */
  services?: number
  /** С какого момента (unix, с) держится её самое старое соединение — в сети не меньше. */
  onlineSince?: number
  /** На сколько секунд её часы расходятся с соседями. */
  clockOffset?: number
  /** ISO-код страны; null — неизвестна. Нет поля — ещё не определяли. */
  country?: string | null
}

/** Соединение двух нод. */
export interface MapLink {
  /** Кто к кому подключился: адрес той, что подключилась. Неизвестно — нет поля. */
  from?: string
  /** Пинг между ними, мс. */
  pingMs?: number
  /** С какого момента держится, unix, с. */
  since?: number
}

/** Нода в пуле прокси: через неё прокси отвечает приложению. */
export interface PoolNode {
  ip: string
  version?: string
  /** Сколько приложений держат через неё живое соединение (WebSocket). */
  users: number
  /** Доля ответов без ошибки, %. */
  successPercent?: number
  /** Среднее время ответа, мс. */
  avgMs?: number
  /** На сколько блоков отстаёт от лучшей ноды прокси. */
  lag?: number
  fork: boolean
}

export interface ProxyState {
  host: string
  port: number
  ok: boolean
  /** Ответ на /ping, мс. */
  latencyMs?: number
  height?: number
  /** Нода, через которую прокси отвечает сейчас. */
  bestNode?: string
  /** Сколько нод прокси знает. */
  known?: number
  pool: PoolNode[]
  /** Открытых соединений приложений (WebSocket) — тонкие клиенты онлайн. */
  clients?: number
  /** Сколько разных аккаунтов среди них. */
  users?: number
  /** Запросов в секунду. */
  rps?: number
  /** Когда прокси запущен, ISO. */
  startedAt?: string
  /** Тот же сервер под другим именем — его цифры не складываем. */
  sameAs?: string
}

export interface NetworkSnapshot {
  nodes: Map<string, MapNode>
  /** Соединения: ключ `a|b`, адреса по алфавиту. */
  links: Map<string, MapLink>
  proxies: ProxyState[]
  /** Когда собрана, мс. */
  takenAt: number
  durationMs: number
  /** Скольких нод спросили и сколько ответили. */
  asked: number
  answered: number
}

export function emptySnapshot(): NetworkSnapshot {
  return {
    nodes: new Map(),
    links: new Map(),
    proxies: [],
    takenAt: 0,
    durationMs: 0,
    asked: 0,
    answered: 0,
  }
}

/** `/Satoshi:0.22.21/` → `0.22.21`. */
export function coreVersion(raw: string | undefined): string | undefined {
  const m = /:(\d+(?:\.\d+)+)/.exec(raw ?? '')
  return m?.[1] ?? (/^\d+(?:\.\d+)+$/.test(raw ?? '') ? raw : undefined)
}

/** Адрес из `ip:порт` и `[ipv6]:порт`. Нода на самом прокси — `127.0.0.1` — своя для каждого прокси. */
export function nodeIp(addr: string, proxyHost?: string): string {
  const m = /^\[(.+)\]:\d+$/.exec(addr) ?? /^([^:]+):\d+$/.exec(addr)
  const ip = m?.[1] ?? addr
  return ip === '127.0.0.1' && proxyHost ? `local@${proxyHost}` : ip
}

export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function linkEnds(key: string): [string, string] {
  const at = key.indexOf('|')
  return [key.slice(0, at), key.slice(at + 1)]
}

function ensureNode(snapshot: NetworkSnapshot, ip: string): MapNode {
  let node = snapshot.nodes.get(ip)
  if (!node) {
    node = { ip, listening: false, answered: false }
    snapshot.nodes.set(ip, node)
  }
  return node
}

/** Флаг NODE_NETWORK: хранит всю историю блоков. */
export const NODE_NETWORK = 1
/** Флаг NODE_NETWORK_LIMITED: отдаёт только последние ~288 блоков. */
export const NODE_NETWORK_LIMITED = 1 << 10

export type NodeKind = 'full' | 'pruned' | 'unknown'

/** Толстый клиент целиком (вся история) или облегчённый (только свежие блоки). */
export function nodeKind(node: MapNode): NodeKind {
  if (node.services === undefined) return 'unknown'
  if (node.services & NODE_NETWORK) return 'full'
  return node.services & NODE_NETWORK_LIMITED ? 'pruned' : 'unknown'
}

/**
 * Нода `ip` рассказала о соседях. Возвращает соседей, которые принимают
 * подключения, — их стоит опросить дальше. Остальные сидят за роутером:
 * спросить их нельзя, но на карте они есть.
 */
export function applyPeers(snapshot: NetworkSnapshot, ip: string, peers: PeerInfo[]): string[] {
  const self = ensureNode(snapshot, ip)
  self.answered = true
  // Её опросили по API — значит, подключения она принимает.
  self.listening = true
  const listening: string[] = []
  for (const peer of peers) {
    const peerIp = nodeIp(peer.addr)
    if (!peerIp || peerIp === ip) continue
    const node = ensureNode(snapshot, peerIp)
    const version = coreVersion(peer.version)
    if (version && !(node.answered && node.version)) node.version = version
    if (!node.answered && peer.synced_blocks > (node.height ?? 0)) node.height = peer.synced_blocks
    const services = parseInt(peer.services, 16)
    if (Number.isFinite(services)) node.services = services
    if (peer.conntime > 0 && (!node.onlineSince || peer.conntime < node.onlineSince)) {
      node.onlineSince = peer.conntime
    }
    if (typeof peer.timeoffset === 'number') node.clockOffset = peer.timeoffset

    const key = linkKey(ip, peerIp)
    const link = snapshot.links.get(key) ?? {}
    // Исходящее соединение: опрошенная нода сама подключилась к этой.
    link.from = peer.inbound ? peerIp : ip
    if (peer.pingtime > 0) link.pingMs = Math.round(peer.pingtime * 1000)
    if (peer.conntime > 0) link.since = peer.conntime
    snapshot.links.set(key, link)

    if (!peer.inbound) {
      node.listening = true
      listening.push(peerIp)
    }
  }
  return listening
}

export interface NodeInfoAnswer {
  version?: string
  /** Время на ноде, unix, с. */
  time?: number
  lastblock?: { height?: number; hash?: string }
}

/** Нода сама сказала версию и высоту — это точнее, чем у соседей. */
export function applyNodeInfo(snapshot: NetworkSnapshot, ip: string, info: NodeInfoAnswer): void {
  const node = ensureNode(snapshot, ip)
  const version = coreVersion(info.version)
  if (version) node.version = version
  if (info.lastblock?.height) node.height = info.lastblock.height
  if (info.lastblock?.hash) node.tipHash = info.lastblock.hash
}

/**
 * Ноды на чужой ветке: на той же высоте, что большинство, у них другой
 * последний блок. Сравниваем только ответившие ноды — у них хеш свой.
 */
export function forkedNodes(snapshot: NetworkSnapshot): Set<string> {
  const byHeight = new Map<number, Map<string, string[]>>()
  for (const node of snapshot.nodes.values()) {
    if (!node.height || !node.tipHash) continue
    const hashes = byHeight.get(node.height) ?? new Map<string, string[]>()
    hashes.set(node.tipHash, [...(hashes.get(node.tipHash) ?? []), node.ip])
    byHeight.set(node.height, hashes)
  }
  const forked = new Set<string>()
  for (const hashes of byHeight.values()) {
    if (hashes.size < 2) continue
    const groups = [...hashes.values()].sort((a, b) => b.length - a.length)
    groups.slice(1).forEach((ips) => ips.forEach((ip) => forked.add(ip)))
  }
  return forked
}

/** Высота сети — самая большая, какую видели. */
export function tipHeight(snapshot: NetworkSnapshot): number {
  let tip = 0
  for (const node of snapshot.nodes.values()) {
    if ((node.height ?? 0) > tip) tip = node.height!
  }
  for (const proxy of snapshot.proxies) {
    if ((proxy.height ?? 0) > tip) tip = proxy.height!
  }
  return tip
}

export type SyncState = 'synced' | 'behind' | 'unknown'

/** Блок примерно в минуту: отстала на пару блоков — ещё в строю. */
export const SYNC_TOLERANCE = 3

export function syncState(node: MapNode, tip: number): SyncState {
  if (!node.height || !tip) return 'unknown'
  return tip - node.height <= SYNC_TOLERANCE ? 'synced' : 'behind'
}

export function degreeMap(snapshot: NetworkSnapshot): Map<string, number> {
  const degree = new Map<string, number>()
  for (const key of snapshot.links.keys()) {
    const [a, b] = linkEnds(key)
    degree.set(a, (degree.get(a) ?? 0) + 1)
    degree.set(b, (degree.get(b) ?? 0) + 1)
  }
  return degree
}

// --- Сохранение: последняя карта переживает перезапуск, а сеть не опрашивается
// при каждом открытии страницы.

interface StoredSnapshot {
  v: 2
  takenAt: number
  durationMs: number
  asked: number
  answered: number
  /** Ноды без адреса — номер в массиве и есть их номер в связях. */
  nodes: Array<Omit<MapNode, 'listening' | 'answered'> & { f: number }>
  /** Пятёрки: номер a, номер b, кто подключился (0 — a, 1 — b, -1 — неизвестно), пинг, с какого момента. */
  links: number[]
  proxies: ProxyState[]
}

export function serializeSnapshot(snapshot: NetworkSnapshot): string {
  const ips = [...snapshot.nodes.keys()]
  const index = new Map(ips.map((ip, i) => [ip, i]))
  const links: number[] = []
  for (const [key, link] of snapshot.links) {
    const [a, b] = linkEnds(key)
    const ia = index.get(a)
    const ib = index.get(b)
    if (ia === undefined || ib === undefined) continue
    links.push(
      ia,
      ib,
      link.from === a ? 0 : link.from === b ? 1 : -1,
      link.pingMs ?? -1,
      link.since ?? 0
    )
  }
  const stored: StoredSnapshot = {
    v: 2,
    takenAt: snapshot.takenAt,
    durationMs: snapshot.durationMs,
    asked: snapshot.asked,
    answered: snapshot.answered,
    nodes: ips.map((ip) => {
      const { listening, answered, ...rest } = snapshot.nodes.get(ip)!
      return { ...rest, f: (listening ? 1 : 0) | (answered ? 2 : 0) }
    }),
    links,
    proxies: snapshot.proxies,
  }
  return JSON.stringify(stored)
}

export function deserializeSnapshot(raw: string | null): NetworkSnapshot | null {
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as StoredSnapshot
    if (stored?.v !== 2 || !Array.isArray(stored.nodes) || !Array.isArray(stored.links)) {
      return null
    }
    const snapshot = emptySnapshot()
    snapshot.takenAt = stored.takenAt
    snapshot.durationMs = stored.durationMs
    snapshot.asked = stored.asked
    snapshot.answered = stored.answered
    snapshot.proxies = Array.isArray(stored.proxies) ? stored.proxies : []
    const ips: string[] = []
    for (const { f, ...node } of stored.nodes) {
      ips.push(node.ip)
      snapshot.nodes.set(node.ip, { ...node, listening: (f & 1) !== 0, answered: (f & 2) !== 0 })
    }
    for (let i = 0; i + 4 < stored.links.length; i += 5) {
      const a = ips[stored.links[i]!]
      const b = ips[stored.links[i + 1]!]
      if (!a || !b) continue
      const dir = stored.links[i + 2]
      const ping = stored.links[i + 3]!
      const since = stored.links[i + 4]!
      const link: MapLink = {}
      if (dir === 0) link.from = a
      else if (dir === 1) link.from = b
      if (ping >= 0) link.pingMs = ping
      if (since > 0) link.since = since
      snapshot.links.set(linkKey(a, b), link)
    }
    return snapshot
  } catch {
    return null
  }
}
