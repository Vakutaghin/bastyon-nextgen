/**
 * Fetch-tunnel для миниапп — обработчик `FETCH_REQUEST` из iframe.
 *
 * Зачем: миниаппа не должна ходить в произвольные сети напрямую, поэтому
 * запросы заворачиваются через `postMessage` в хост, который проверяет:
 *
 *  1. **Allowlist хостов** — `manifest.fetchHosts` (origin: схема + host[:port]).
 *     Если массив пуст / нет совпадения — `forbidden_host`.
 *  2. **Per-app rate limit** — класс `expensive` через {@link RateLimiter}.
 *     При исчерпании — `rate_limit_exceeded` с `retryAfterMs` в payload.
 *  3. **Hard timeout** — `DEFAULT_FETCH_TIMEOUT_MS`, AbortController.
 *
 * Transport абстрагирован: по умолчанию — `appFetch`, который централизованно
 * маршрутизирует запрос (Tor через `torFetch` когда включён в Tauri; plugin-http
 * для CORS-bypass в Tauri; браузерный `fetch` иначе). Это делает реальный
 * транспорт согласованным с `alttransport`-репортом хосту — миниаппа не утечёт
 * IP мимо Tor (P1-6).
 *
 * HMAC: на iframe↔host hop не нужен — origin уже проверен `origin-guard`.
 * Подпись имеет смысл только если запросы идут через **внешний** реле/прокси,
 * где сервер должен убедиться в идентичности отправителя. Тогда — добавлять
 * в `FetchTunnelTransport.fetch` подпись по ключу из `app.author` (on-chain pubkey).
 *
 * См. CODE_AUDIT.md §9.1.
 */

import type { InstalledApp } from '../types/app'
import type { FetchRequest, FetchResponse } from '../types/messages'
import { fetchResponseError, fetchResponseOk } from '../types/messages'
import { RateLimiter, RateLimitExceededError } from './rate-limiter'
import { appFetch } from '@/helpers/api/fetch-strategies'

export const DEFAULT_FETCH_TIMEOUT_MS = 30_000

export interface FetchTunnelTransport {
  /** Выполняет реальный сетевой запрос. По умолчанию — глобальный `fetch`. */
  fetch: (input: string, init: RequestInit) => Promise<Response>
}

export interface FetchTunnelOptions {
  /** Рейт-лимитер. Если не передан — создаётся свой, конфиг по умолчанию. */
  rateLimiter?: RateLimiter
  /** Сетевой транспорт. По умолчанию — глобальный fetch. */
  transport?: FetchTunnelTransport
  /** Таймаут на один запрос. */
  timeoutMs?: number
}

export interface FetchTunnel {
  handle: (app: InstalledApp, req: FetchRequest) => Promise<FetchResponse>
  /** Сброс rate-limiter buckets (для тестов / unload). */
  reset: () => void
}

function isAllowedOrigin(url: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  // Сверяемся по полному origin (схема + host + порт). `URL().origin`
  // нормализует регистр и опускает default-порты — безопаснее префиксного сравнения.
  return allowlist.includes(parsed.origin)
}

function defaultTransport(): FetchTunnelTransport {
  // appFetch торифицирует (когда Tor включён в Tauri) и обходит CORS через
  // plugin-http; в вебе деградирует до браузерного fetch. Не `globalThis.fetch`
  // напрямую — иначе IP миниаппы утечёт мимо Tor (P1-6).
  return { fetch: (input, init) => appFetch(input, init) }
}

function requestInitFrom(req: FetchRequest['request'], signal: AbortSignal): RequestInit {
  const init: RequestInit = {
    method: req.method ?? 'GET',
    headers: req.headers,
    signal,
  }
  if (req.body && req.body.length > 0) {
    init.body = new Uint8Array(req.body)
  }
  return init
}

async function responseToWire(resp: Response): Promise<NonNullable<FetchResponse['data']>> {
  const headers: Record<string, string> = {}
  resp.headers.forEach((v, k) => {
    headers[k] = v
  })
  const buf = await resp.arrayBuffer()
  return {
    status: resp.status,
    statusText: resp.statusText,
    headers,
    body: Array.from(new Uint8Array(buf)),
  }
}

export function createFetchTunnel(opts: FetchTunnelOptions = {}): FetchTunnel {
  const limiter = opts.rateLimiter ?? new RateLimiter()
  const transport = opts.transport ?? defaultTransport()
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS

  return {
    async handle(app, req) {
      // 1. Allowlist
      if (!isAllowedOrigin(req.request.url, app.manifest.fetchHosts)) {
        return fetchResponseError(req.requestId, 'forbidden_host')
      }

      // 2. Rate limit (класс expensive — сетевой I/O).
      try {
        limiter.consume(app.manifest.id, 'expensive')
      } catch (e) {
        if (e instanceof RateLimitExceededError) {
          return fetchResponseError(req.requestId, `rate_limit_exceeded:${e.retryAfterMs}`)
        }
        throw e
      }

      // 3. Транспорт с таймаутом.
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const resp = await transport.fetch(
          req.request.url,
          requestInitFrom(req.request, ctrl.signal)
        )
        const data = await responseToWire(resp)
        return fetchResponseOk(req.requestId, data)
      } catch (e) {
        const isAbort =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError')
        const reason = isAbort
          ? 'timeout'
          : e instanceof Error
            ? `network_error:${e.message}`
            : 'network_error'
        return fetchResponseError(req.requestId, reason)
      } finally {
        clearTimeout(timer)
      }
    },
    reset() {
      limiter.reset()
    },
  }
}
