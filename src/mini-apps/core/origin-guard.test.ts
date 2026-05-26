import { describe, it, expect } from 'vitest'
import {
  normalizeOrigin,
  safeNormalizeOrigin,
  matchesOrigin,
  createInMemoryResolver,
} from './origin-guard'
import type { InstalledApp } from '../types/app'
import type { ParsedManifest } from '../types/manifest'

function mockApp(scope: string, tscope?: string, id = 'test.app'): InstalledApp {
  return {
    manifest: { id } as ParsedManifest,
    scope,
    tscope,
    icon: '',
    source: 'built-in',
    installedAt: 0,
  }
}

describe('normalizeOrigin', () => {
  it('adds https scheme to bare host', () => {
    expect(normalizeOrigin('example.com')).toBe('https://example.com')
  })

  it('preserves https URL', () => {
    expect(normalizeOrigin('https://example.com')).toBe('https://example.com')
  })

  it('strips path/search/hash', () => {
    expect(normalizeOrigin('https://example.com/foo?bar=1#x')).toBe('https://example.com')
  })

  it('preserves port', () => {
    expect(normalizeOrigin('https://example.com:8443')).toBe('https://example.com:8443')
  })

  it('accepts http (for dev / localhost)', () => {
    expect(normalizeOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('throws on empty input', () => {
    expect(() => normalizeOrigin('')).toThrow()
    expect(() => normalizeOrigin('   ')).toThrow()
  })

  it('throws on invalid URL', () => {
    expect(() => normalizeOrigin('not a url with spaces')).toThrow()
  })
})

describe('safeNormalizeOrigin', () => {
  it('returns null instead of throwing', () => {
    expect(safeNormalizeOrigin('')).toBeNull()
    expect(safeNormalizeOrigin(null)).toBeNull()
    expect(safeNormalizeOrigin(undefined)).toBeNull()
  })

  it('still normalizes valid input', () => {
    expect(safeNormalizeOrigin('example.com')).toBe('https://example.com')
  })
})

describe('matchesOrigin', () => {
  it('matches canonical scope', () => {
    const app = mockApp('demo.app.com')
    expect(matchesOrigin(app, 'https://demo.app.com')).toBe(true)
  })

  it('matches scope with trailing path', () => {
    const app = mockApp('https://demo.app.com/index.html')
    expect(matchesOrigin(app, 'https://demo.app.com')).toBe(true)
  })

  it('matches tscope', () => {
    const app = mockApp('demo.app.com', 'test.demo.app.com')
    expect(matchesOrigin(app, 'https://test.demo.app.com')).toBe(true)
  })

  it('rejects different origin', () => {
    const app = mockApp('demo.app.com')
    expect(matchesOrigin(app, 'https://other.com')).toBe(false)
  })

  // ─── CLOSES 1.1: legacy `startsWith` vulnerability ─────────────────────────

  it('rejects origin where attacker prepends victim host', () => {
    const app = mockApp('demo.app.com')
    // Legacy startsWith would say "https://demo.app.com".startsWith("https://demo.app.com.evil.com")
    // is false, OK. But this is the other direction:
    expect(matchesOrigin(app, 'https://demo.app.com.evil.com')).toBe(false)
  })

  it('rejects origin where attacker appends to victim host', () => {
    const app = mockApp('demo.app.com')
    // legacy startsWith of "https://demo.app.com" against tscope "https://demo.app.com.evil" → bug
    expect(matchesOrigin(app, 'https://demo.app.commercial.evil')).toBe(false)
  })

  it('rejects mixed scheme', () => {
    const app = mockApp('https://demo.app.com')
    expect(matchesOrigin(app, 'http://demo.app.com')).toBe(false)
  })

  it('rejects port mismatch', () => {
    const app = mockApp('https://demo.app.com')
    expect(matchesOrigin(app, 'https://demo.app.com:8443')).toBe(false)
  })

  it('rejects empty origin', () => {
    expect(matchesOrigin(mockApp('demo.app.com'), '')).toBe(false)
  })

  it('handles invalid scope gracefully', () => {
    const app = mockApp('not a url ###')
    expect(matchesOrigin(app, 'https://anything.com')).toBe(false)
  })
})

describe('createInMemoryResolver', () => {
  it('finds app by origin', () => {
    const a = mockApp('a.com', undefined, 'app.a')
    const b = mockApp('b.com', undefined, 'app.b')
    const r = createInMemoryResolver([a, b])

    expect(r.resolveByOrigin('https://a.com')?.manifest.id).toBe('app.a')
    expect(r.resolveByOrigin('https://b.com')?.manifest.id).toBe('app.b')
  })

  it('returns null for unknown origin', () => {
    const r = createInMemoryResolver([mockApp('a.com')])
    expect(r.resolveByOrigin('https://unknown.com')).toBeNull()
    expect(r.resolveByOrigin('')).toBeNull()
  })

  it('finds app by id', () => {
    const a = mockApp('a.com', undefined, 'app.a')
    const r = createInMemoryResolver([a])
    expect(r.resolveById('app.a')?.scope).toBe('a.com')
    expect(r.resolveById('app.missing')).toBeNull()
  })
})
