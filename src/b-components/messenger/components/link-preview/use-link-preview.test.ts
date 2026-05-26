import { describe, it, expect, beforeEach, vi } from 'vitest'

import { __linkPreviewInternals } from './use-link-preview'
import { matrixService } from '../../services/matrix-service'

const { cache, inflight, fetchPreview } = __linkPreviewInternals

beforeEach(() => {
  cache.clear()
  inflight.clear()
})

describe('fetchPreview (use-link-preview)', () => {
  it('returns null when matrix client has no getUrlPreview', async () => {
    vi.spyOn(matrixService, 'getClient').mockReturnValue({} as any)
    const r = await fetchPreview('https://example.com')
    expect(r).toBeNull()
    expect(cache.get('https://example.com')).toBeNull()
  })

  it('maps OG fields and trims long description', async () => {
    const longText = 'x'.repeat(500)
    vi.spyOn(matrixService, 'getClient').mockReturnValue({
      getUrlPreview: async () => ({
        'og:title': 'Hello',
        'og:description': longText,
        'og:image': 'https://cdn.example.com/img.png',
        'og:site_name': 'Example',
      }),
    } as any)

    const r = await fetchPreview('https://example.com/post')
    expect(r).not.toBeNull()
    expect(r!.title).toBe('Hello')
    expect(r!.imageUrl).toBe('https://cdn.example.com/img.png')
    expect(r!.siteName).toBe('Example')
    expect(r!.description!.length).toBeLessThanOrEqual(201)
    expect(r!.description!.endsWith('…')).toBe(true)
  })

  it('returns null when no OG fields are present (title/description/image)', async () => {
    vi.spyOn(matrixService, 'getClient').mockReturnValue({
      getUrlPreview: async () => ({ 'og:type': 'website' }),
    } as any)
    const r = await fetchPreview('https://nope.example.com')
    expect(r).toBeNull()
  })

  it('caches result by URL — second call does not hit network', async () => {
    let calls = 0
    vi.spyOn(matrixService, 'getClient').mockReturnValue({
      getUrlPreview: async () => {
        calls++
        return { 'og:title': 'Cached' }
      },
    } as any)
    const a = await fetchPreview('https://a.example.com')
    const b = await fetchPreview('https://a.example.com')
    expect(calls).toBe(1)
    expect(a?.title).toBe('Cached')
    expect(b?.title).toBe('Cached')
  })

  it('dedupes in-flight requests for the same URL', async () => {
    let calls = 0
    let resolveOuter: (() => void) | null = null
    vi.spyOn(matrixService, 'getClient').mockReturnValue({
      getUrlPreview: () => {
        calls++
        return new Promise<any>((resolve) => {
          resolveOuter = () => resolve({ 'og:title': 'Once' })
        })
      },
    } as any)
    const p1 = fetchPreview('https://b.example.com')
    const p2 = fetchPreview('https://b.example.com')
    expect(calls).toBe(1)
    resolveOuter!()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1?.title).toBe('Once')
    expect(r2?.title).toBe('Once')
  })

  it('returns null on getUrlPreview throw and caches the null', async () => {
    vi.spyOn(matrixService, 'getClient').mockReturnValue({
      getUrlPreview: async () => {
        throw new Error('network')
      },
    } as any)
    const r = await fetchPreview('https://err.example.com')
    expect(r).toBeNull()
    expect(cache.has('https://err.example.com')).toBe(true)
  })
})
