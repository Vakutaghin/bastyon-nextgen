/**
 * SSRF-фильтр для URL, которые задаёт не мы, а мини-приложение или его
 * манифест (V25): fetch-tunnel, `authFetch` с подписью, загрузка манифеста.
 *
 * Отсекаем не-https, loopback, приватные и link-local адреса, `localhost`/
 * `.local`. Числовые формы IPv4 (`2130706433`, `0x7f000001`, `127.1`) WHATWG-
 * парсер уже нормализует в точечную запись, поэтому проверяем hostname после
 * `new URL()`. IPv4-mapped IPv6 (`::ffff:127.0.0.1`) разворачиваем сами.
 * Rust-сторона (`tor_fetch`) дублирует проверку для Tor-транспорта.
 */

export type ExternalUrlVerdict = 'ok' | 'bad_url' | 'bad_scheme' | 'private_host'

export interface ExternalUrlOptions {
  /** Разрешить `http:` (по умолчанию только https). */
  allowHttp?: boolean
  /** Разрешить loopback (127/8, ::1, localhost) — dev-бэкенд sideload-приложения. */
  allowLoopback?: boolean
}

const PRIVATE_V4 = [
  [10, 0, 0, 0, 8],
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [169, 254, 0, 0, 16], // link-local / cloud metadata
  [100, 64, 0, 0, 10], // CGNAT
  [0, 0, 0, 0, 8],
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved + broadcast
] as const

function v4ToInt(a: number, b: number, c: number, d: number): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

function inCidr(ip: number, base: readonly [number, number, number, number, number]): boolean {
  const [a, b, c, d, bits] = base
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ip & mask) >>> 0 === (v4ToInt(a, b, c, d) & mask) >>> 0
}

function parseV4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number) as [number, number, number, number]
  return parts.every((n) => n <= 255) ? parts : null
}

function classifyV4(
  parts: [number, number, number, number],
  allowLoopback: boolean
): ExternalUrlVerdict {
  const ip = v4ToInt(...parts)
  if (parts[0] === 127) return allowLoopback ? 'ok' : 'private_host'
  return PRIVATE_V4.some((r) => inCidr(ip, r)) ? 'private_host' : 'ok'
}

/** Раскрывает `::` и встроенный IPv4 → 8 групп по 16 бит; null для мусора. */
function expandV6(host: string): number[] | null {
  let h = host
  const lastColon = h.lastIndexOf(':')
  if (lastColon !== -1 && h.slice(lastColon + 1).includes('.')) {
    const v4 = parseV4(h.slice(lastColon + 1))
    if (!v4) return null
    h = `${h.slice(0, lastColon)}:${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }
  const halves = h.split('::')
  if (halves.length > 2) return null
  const toGroups = (s: string): number[] | null => {
    if (!s) return []
    const out: number[] = []
    for (const g of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const left = toGroups(halves[0] ?? '')
  const right = halves.length === 2 ? toGroups(halves[1] ?? '') : []
  if (!left || !right) return null
  const missing = 8 - left.length - right.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null
  return [...left, ...new Array<number>(missing).fill(0), ...right]
}

function classifyV6(host: string, allowLoopback: boolean): ExternalUrlVerdict {
  const g = expandV6(host)
  if (!g) return 'bad_url'
  const isMapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff
  if (isMapped) {
    const v4: [number, number, number, number] = [
      g[6]! >> 8,
      g[6]! & 0xff,
      g[7]! >> 8,
      g[7]! & 0xff,
    ]
    return classifyV4(v4, allowLoopback)
  }
  const allZero = g.every((x) => x === 0)
  if (allZero) return 'private_host' // ::
  const loopback = g.slice(0, 7).every((x) => x === 0) && g[7] === 1
  if (loopback) return allowLoopback ? 'ok' : 'private_host'
  const first = g[0]!
  if ((first & 0xfe00) === 0xfc00) return 'private_host' // ULA fc00::/7
  if ((first & 0xffc0) === 0xfe80) return 'private_host' // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return 'private_host' // multicast
  return 'ok'
}

export function classifyExternalUrl(
  url: string,
  opts: ExternalUrlOptions = {}
): ExternalUrlVerdict {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'bad_url'
  }
  if (parsed.protocol !== 'https:' && !(opts.allowHttp && parsed.protocol === 'http:')) {
    return 'bad_scheme'
  }
  const allowLoopback = opts.allowLoopback === true
  const host = parsed.hostname.toLowerCase()
  if (!host) return 'bad_url'

  if (host.startsWith('[') && host.endsWith(']')) {
    return classifyV6(host.slice(1, -1), allowLoopback)
  }
  const v4 = parseV4(host)
  if (v4) return classifyV4(v4, allowLoopback)

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return allowLoopback ? 'ok' : 'private_host'
  }
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return 'private_host'
  }
  if (/^[0-9a-fx.]+$/i.test(host) && /\d/.test(host) && !host.includes('-')) {
    // Числовой хост, который парсер не нормализовал в IPv4 — не рискуем.
    return 'private_host'
  }
  return 'ok'
}

export function isSafeExternalUrl(url: string, opts: ExternalUrlOptions = {}): boolean {
  return classifyExternalUrl(url, opts) === 'ok'
}
