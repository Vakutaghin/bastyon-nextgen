import { describe, it, expect, vi } from 'vitest'
import { createFetchTunnel } from './fetch-tunnel'
import { RateLimiter } from './rate-limiter'
import type { InstalledApp } from '../types/app'
import type { FetchRequest } from '../types/messages'

function makeApp(fetchHosts: string[] = []): InstalledApp {
  return {
    manifest: {
      id: 'test.app',
      name: 'Test',
      version: 1_000_000,
      versionText: '1.0.0',
      description: 'test',
      descriptions: {},
      author: 'PQ',
      develop: false,
      permissions: [],
      fetchHosts,
    },
    scope: 'test.bastyonapps.com',
    grantedPermissions: [],
  } as unknown as InstalledApp
}

function makeReq(url: string, requestId = 'r1'): FetchRequest {
  return {
    type: 'FETCH_REQUEST',
    requestId,
    request: { url, method: 'GET' },
  }
}

describe('fetch-tunnel', () => {
  it('rejects request with empty allowlist', async () => {
    const tunnel = createFetchTunnel({ transport: { fetch: vi.fn() } })
    const resp = await tunnel.handle(makeApp([]), makeReq('https://api.example.com/x'))
    expect(resp.success).toBe(false)
    expect(resp.error).toBe('forbidden_host')
  })

  it('rejects host not in allowlist', async () => {
    const tunnel = createFetchTunnel({
      transport: { fetch: vi.fn() },
    })
    const resp = await tunnel.handle(
      makeApp(['https://allowed.example.com']),
      makeReq('https://other.example.com/x')
    )
    expect(resp.success).toBe(false)
    expect(resp.error).toBe('forbidden_host')
  })

  it('passes request through when host is allowed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('ok', { status: 200, statusText: 'OK', headers: { 'x-test': '1' } })
      )
    const tunnel = createFetchTunnel({ transport: { fetch: fetchMock } })

    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://api.example.com/v1/data')
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(resp.success).toBe(true)
    expect(resp.data?.status).toBe(200)
    expect(resp.data?.headers['x-test']).toBe('1')
  })

  it('normalizes origin via URL().origin (case + default port)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 204 }))
    const tunnel = createFetchTunnel({ transport: { fetch: fetchMock } })

    // Allowlist уже нормализован парсером манифеста, но проверяем что matcher
    // тоже использует URL().origin (защита от префикса/case-смешения).
    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://API.EXAMPLE.COM:443/x') // 443 = default → opens to api.example.com
    )
    expect(resp.success).toBe(true)
  })

  it('returns rate_limit_exceeded after bucket depletes', async () => {
    // mockImplementation — каждый вызов даёт свежий Response (иначе .arrayBuffer()
    // на повторно используемом Response бросает TypeError "body already read").
    const fetchMock = vi.fn().mockImplementation(() => new Response('', { status: 200 }))
    // Маленький бакет для теста — 2 запроса, восполнение 0.001/s (медленное).
    const limiter = new RateLimiter({
      classes: { expensive: { capacity: 2, refillPerSec: 0.001 } },
    })
    const tunnel = createFetchTunnel({ transport: { fetch: fetchMock }, rateLimiter: limiter })
    const app = makeApp(['https://api.example.com'])

    const r1 = await tunnel.handle(app, makeReq('https://api.example.com/1', 'a'))
    const r2 = await tunnel.handle(app, makeReq('https://api.example.com/2', 'b'))
    const r3 = await tunnel.handle(app, makeReq('https://api.example.com/3', 'c'))

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r3.success).toBe(false)
    expect(r3.error).toMatch(/^rate_limit_exceeded:/)
  })

  it('returns timeout error when transport hangs past timeoutMs', async () => {
    // Transport никогда не резолвится, но должен реагировать на AbortSignal.
    const transport = {
      fetch: (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    }
    const tunnel = createFetchTunnel({ transport, timeoutMs: 10 })
    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://api.example.com/slow')
    )
    expect(resp.success).toBe(false)
    expect(resp.error).toBe('timeout')
  })

  it('wraps unexpected transport errors as network_error', async () => {
    const transport = { fetch: vi.fn().mockRejectedValue(new Error('TCP reset')) }
    const tunnel = createFetchTunnel({ transport })
    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://api.example.com/x')
    )
    expect(resp.success).toBe(false)
    expect(resp.error).toBe('network_error:TCP reset')
  })
})
