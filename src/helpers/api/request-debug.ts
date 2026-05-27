/**
 * Tor-debug инфраструктура: счётчики прошедших/прямых/упавших запросов
 * + последние N URL-ов с метаданными.
 *
 * Экспонируется на `window.__torDebug` для live-introspection в консоли.
 * `__torDebug.summary()` — счётчики, `__torDebug.recent()` — последние запросы,
 * `__torDebug.checkIp()` — сравнить «прямой» и «через Tor» IP.
 */

import { appFetch } from './fetch-strategies'

export type TorDebugEntry = {
  url: string
  usedTor: boolean
  durationMs: number
  error?: string
  at: number
}

export type TorDebugStats = {
  enabled: boolean
  through: number
  direct: number
  failed: number
  recent: TorDebugEntry[]
  lastUrl?: string
}

const TOR_DEBUG_KEY = '__torDebug'
export const TOR_DEBUG_RECENT_LIMIT = 50

export function recordTorRequest(
  url: string,
  usedTor: boolean,
  durationMs: number,
  error?: string
): void {
  const stats = ensureDebug()._stats
  if (error) stats.failed += 1
  else if (usedTor) stats.through += 1
  else stats.direct += 1
  stats.lastUrl = url
  const entry: TorDebugEntry = { url, usedTor, durationMs, error, at: Date.now() }
  stats.recent.push(entry)
  if (stats.recent.length > TOR_DEBUG_RECENT_LIMIT) {
    stats.recent.shift()
  }
}

export function ensureDebug(): {
  _stats: TorDebugStats
  summary: () => TorDebugStats
  recent: () => TorDebugEntry[]
  reset: () => void
  checkIp: () => Promise<{ direct: string; viaTor: string | null; same: boolean }>
} {
  const w = globalThis as unknown as Record<string, unknown>
  const existing = w[TOR_DEBUG_KEY] as ReturnType<typeof ensureDebug> | undefined
  if (existing) return existing
  const stats: TorDebugStats = {
    enabled: false,
    through: 0,
    direct: 0,
    failed: 0,
    recent: [],
  }
  const debug = {
    _stats: stats,
    summary(): TorDebugStats {
      return { ...stats, recent: stats.recent.slice() }
    },
    recent(): TorDebugEntry[] {
      return stats.recent.slice()
    },
    reset(): void {
      stats.through = 0
      stats.direct = 0
      stats.failed = 0
      stats.recent.length = 0
      stats.lastUrl = undefined
    },
    async checkIp(): Promise<{ direct: string; viaTor: string | null; same: boolean }> {
      const directResp = await globalThis.fetch('https://api.ipify.org?format=json')
      const direct = (await directResp.json()).ip as string
      let viaTor: string | null
      try {
        const r = await appFetch('https://api.ipify.org?format=json')
        viaTor = (await r.json()).ip as string
      } catch (e) {
        viaTor = `error: ${(e as Error).message}`
      }
      return { direct, viaTor, same: direct === viaTor }
    },
  }
  w[TOR_DEBUG_KEY] = debug
  return debug
}

// Initialise lazily when this module first loads in a window.
if (typeof window !== 'undefined') {
  ensureDebug()
}
