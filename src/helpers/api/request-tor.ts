/**
 * Tor-туннель через Tauri-команду `tor_fetch`. Энкодит request как base64,
 * передаёт invoke'ом в Rust, декодирует ответ обратно в `Response`.
 *
 * Все вспомогательные helpers для конвертации body/headers сюда же —
 * они нигде больше не используются и тесно связаны с `tor_fetch` контрактом.
 */

import type { TorFetchRequest, TorFetchResponse } from './types/request'
import { recordTorRequest } from './request-debug'

/** Tauri 1/2 detection: __TAURI__, __TAURI_INTERNALS__, __TAURI_METADATA__, or any __TAURI* key. */
export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  if (typeof w.__TAURI__ !== 'undefined') return true
  if (typeof w.__TAURI_INTERNALS__ !== 'undefined') return true
  if (typeof w.__TAURI_METADATA__ !== 'undefined') return true
  try {
    if (Object.keys(w).some((k) => k.startsWith('__TAURI'))) return true
  } catch {
    /* ignore */
  }
  return false
}

/** In Tauri production, browser fetch hits CORS (e.g. Authorization not allowed). Plugin-http bypasses CORS. */
export async function getTauriFetch(): Promise<typeof globalThis.fetch | undefined> {
  const isTauri = isTauriEnv() || import.meta.env?.VITE_TAURI === 'true'
  if (!isTauri) return undefined
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch as typeof globalThis.fetch
  } catch {
    return undefined
  }
}

export function isSameOriginUrl(url: string): boolean {
  if (!url) return false
  // Relative URLs are always same-origin.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(url).origin === window.location.origin
  } catch {
    return false
  }
}

export async function shouldTorifyRequest(): Promise<boolean> {
  if (!isTauriEnv()) return false
  try {
    const { useTorStore } = await import('@/stores/tor-store')
    const store = useTorStore()
    return store.shouldTorify
  } catch {
    return false
  }
}

export async function torFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const url = inputToUrl(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = headersToRecord(input, init)
  const bodyBytes = await bodyToBytes(init?.body, headers)

  const req: TorFetchRequest = {
    url,
    method,
    headers,
    body_b64: bodyBytes ? bytesToBase64(bodyBytes) : undefined,
  }

  const { invoke } = await import('@tauri-apps/api/core')
  let resp: TorFetchResponse
  const startedAt = performance.now()
  try {
    resp = await invoke<TorFetchResponse>('tor_fetch', { req })
  } catch (e) {
    const message = typeof e === 'string' ? e : ((e as Error)?.message ?? JSON.stringify(e))
    recordTorRequest(url, false, performance.now() - startedAt, message)
    throw new Error(`tor_fetch failed (${url}): ${message}`, { cause: e })
  }
  recordTorRequest(url, resp.used_tor, performance.now() - startedAt)

  const responseHeaders = new Headers()
  for (const [k, v] of resp.headers) {
    try {
      responseHeaders.append(k, v)
    } catch {
      // ignore non-conformant headers (e.g. Set-Cookie variants)
    }
  }

  const bodyBuf = base64ToBytes(resp.body_b64)
  return new Response(bodyBuf as unknown as BodyInit, {
    status: resp.status,
    statusText: resp.status_text,
    headers: responseHeaders,
  })
}

// --- body/header conversion helpers (private к torFetch контракту) ----------

function inputToUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function headersToRecord(input: RequestInfo | URL, init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {}
  const collect = (h: HeadersInit) => {
    if (h instanceof Headers) {
      h.forEach((v, k) => {
        out[k] = v
      })
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) out[k] = v
    } else {
      Object.assign(out, h)
    }
  }
  if (input instanceof Request && input.headers) collect(input.headers)
  if (init?.headers) collect(init.headers)
  return out
}

async function bodyToBytes(
  body: BodyInit | null | undefined,
  headers: Record<string, string>
): Promise<Uint8Array | undefined> {
  if (body == null) return undefined
  if (typeof body === 'string') {
    return new TextEncoder().encode(body)
  }
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    const buf = await body.arrayBuffer()
    return new Uint8Array(buf)
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    if (!hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    return new TextEncoder().encode(body.toString())
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    // Encode FormData via Request to get a multipart body the same way fetch would.
    const tmp = new Request('http://localhost', { method: 'POST', body })
    const buf = await tmp.arrayBuffer()
    const ctype = tmp.headers.get('content-type')
    if (ctype && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = ctype
    }
    return new Uint8Array(buf)
  }
  // Fallback: treat as string-like.
  return new TextEncoder().encode(String(body))
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lc = name.toLowerCase()
  return Object.keys(headers).some((k) => k.toLowerCase() === lc)
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
