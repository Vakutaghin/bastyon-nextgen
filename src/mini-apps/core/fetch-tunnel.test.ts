import { describe, it, expect, vi } from 'vitest'

// P1-6: транспорт по умолчанию должен идти через appFetch (Tor-aware), а не
// сырой globalThis.fetch. Мокаем модуль — остальные тесты дают явный transport,
// поэтому на них мок не влияет.
vi.mock('@/helpers/api/fetch-strategies', () => ({
  appFetch: vi.fn(() => Promise.resolve(new Response('ok', { status: 200 }))),
}))

import { createFetchTunnel } from './fetch-tunnel'
import { RateLimiter } from './rate-limiter'
import { appFetch } from '@/helpers/api/fetch-strategies'
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

  it('V25: loopback/приватный хост из allowlist всё равно forbidden_host', async () => {
    const transport = { fetch: vi.fn() }
    const tunnel = createFetchTunnel({ transport })
    for (const url of [
      'https://127.0.0.1:8080/x',
      'https://localhost/x',
      'https://192.168.1.5/x',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/x',
      'http://api.example.com/x',
    ]) {
      const resp = await tunnel.handle(makeApp([new URL(url).origin]), makeReq(url))
      expect(resp.error, url).toBe('forbidden_host')
    }
    expect(transport.fetch).not.toHaveBeenCalled()
  })

  it('V25: sideload-приложению (source: local) разрешён http/loopback', async () => {
    const transport = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) }
    const tunnel = createFetchTunnel({ transport })
    const app = { ...makeApp(['http://localhost:3000']), source: 'local' } as InstalledApp
    const resp = await tunnel.handle(app, makeReq('http://localhost:3000/api'))
    expect(resp.success).toBe(true)
  })

  it('V25: редиректы не следуем — init содержит redirect manual + maxRedirections 0', async () => {
    const fetchFn = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('ok', { status: 200 })
    )
    const tunnel = createFetchTunnel({ transport: { fetch: fetchFn } })
    await tunnel.handle(makeApp(['https://api.example.com']), makeReq('https://api.example.com/x'))
    const init = fetchFn.mock.calls[0]![1] as RequestInit & { maxRedirections?: number }
    expect(init.redirect).toBe('manual')
    expect(init.maxRedirections).toBe(0)
    expect(init.credentials).toBe('omit')
  })

  it('V25: opaqueredirect от браузерного fetch → redirect_not_followed', async () => {
    const opaque = {
      type: 'opaqueredirect',
      status: 0,
      headers: new Headers(),
    } as unknown as Response
    const transport = { fetch: vi.fn(async () => opaque) }
    const tunnel = createFetchTunnel({ transport })
    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://api.example.com/x')
    )
    expect(resp.success).toBe(false)
    expect(resp.error).toBe('redirect_not_followed')
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

  it('default transport routes through appFetch (Tor-aware) — P1-6', async () => {
    vi.mocked(appFetch).mockClear()
    const tunnel = createFetchTunnel() // без явного transport → defaultTransport()
    const resp = await tunnel.handle(
      makeApp(['https://api.example.com']),
      makeReq('https://api.example.com/x')
    )
    expect(appFetch).toHaveBeenCalledTimes(1)
    expect(resp.success).toBe(true)
  })
})
