import { describe, it, expect, vi } from 'vitest'
import { ManifestLoader, buildManifestUrl } from './manifest-loader'
import { ManifestParseError } from '../types/manifest'

const VALID_AUTHOR = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'

function manifestJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'demo.app',
    name: 'Demo',
    version: '1.0.0',
    description: 'desc',
    author: VALID_AUTHOR,
    permissions: ['account'],
    ...overrides,
  })
}

/** Создаёт mock-fetch который отдаёт текст или статус. */
function mockFetch(handler: (url: string) => { ok: boolean; status?: number; text: string }) {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const r = handler(url)
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      text: async () => r.text,
    } as unknown as Response
  })
}

describe('buildManifestUrl', () => {
  it('appends b_manifest.json to bare host', () => {
    expect(buildManifestUrl('demo.app.com')).toBe('https://demo.app.com/b_manifest.json')
  })
  it('handles scope with path', () => {
    expect(buildManifestUrl('bastyon.com/blockexplorer')).toBe(
      'https://bastyon.com/blockexplorer/b_manifest.json'
    )
  })
  it('strips https:// prefix if present', () => {
    expect(buildManifestUrl('https://demo.app.com')).toBe('https://demo.app.com/b_manifest.json')
  })
  it('strips trailing slash', () => {
    expect(buildManifestUrl('demo.app.com/')).toBe('https://demo.app.com/b_manifest.json')
  })
})

describe('ManifestLoader', () => {
  it('fetches and parses manifest', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: manifestJson() }))
    const loader = new ManifestLoader({ fetchImpl })

    const m = await loader.load('demo.app.com')
    expect(m.id).toBe('demo.app')
    expect(m.name).toBe('Demo')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('caches result for repeated calls within TTL', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: manifestJson() }))
    const loader = new ManifestLoader({ fetchImpl, ttlMs: 60_000 })

    await loader.load('demo.app.com')
    await loader.load('demo.app.com')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('force=true bypasses cache', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: manifestJson() }))
    const loader = new ManifestLoader({ fetchImpl })

    await loader.load('demo.app.com')
    await loader.load('demo.app.com', true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('invalidate() removes cache entry', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: manifestJson() }))
    const loader = new ManifestLoader({ fetchImpl })

    await loader.load('demo.app.com')
    loader.invalidate('demo.app.com')
    await loader.load('demo.app.com')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('coalesces in-flight requests to the same scope', async () => {
    // Holder вместо `let | null` — иначе TS control-flow analysis думает что
    // переменная всегда null (присваивается в неконтрольной функции).
    const holder: { resolve: (r: { ok: boolean; text: string }) => void } = {
      resolve: () => {},
    }
    const fetchImpl = vi.fn(async () => {
      const r = await new Promise<{ ok: boolean; text: string }>((res) => {
        holder.resolve = res
      })
      return {
        ok: r.ok,
        status: 200,
        text: async () => r.text,
      } as unknown as Response
    })
    const loader = new ManifestLoader({ fetchImpl })

    const p1 = loader.load('demo.app.com')
    const p2 = loader.load('demo.app.com')
    // Дать time fetchImpl стартовать и проставить holder.resolve
    await Promise.resolve()
    holder.resolve({ ok: true, text: manifestJson() })

    const [a, b] = await Promise.all([p1, p2])
    expect(a).toBe(b) // тот же объект из in-flight
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('throws on HTTP error', async () => {
    const fetchImpl = mockFetch(() => ({ ok: false, status: 404, text: '' }))
    const loader = new ManifestLoader({ fetchImpl })

    await expect(loader.load('demo.app.com')).rejects.toThrow(/404/)
  })

  it('throws ManifestParseError on invalid JSON', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: 'not json' }))
    const loader = new ManifestLoader({ fetchImpl })

    await expect(loader.load('demo.app.com')).rejects.toBeInstanceOf(ManifestParseError)
  })

  it('throws on invalid author bitcoin address', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, text: manifestJson({ author: 'fake' }) }))
    const loader = new ManifestLoader({ fetchImpl })

    await expect(loader.load('demo.app.com')).rejects.toBeInstanceOf(ManifestParseError)
  })
})
