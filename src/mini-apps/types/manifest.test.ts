import { describe, it, expect } from 'vitest'
import {
  parseManifest,
  parseManifestObject,
  versionToNumber,
  ManifestParseError,
  type RawManifest,
} from './manifest'

// Адреса из реальных legacy миниапп — известно валидны.
const VALID_AUTHOR = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'
const VALID_AUTHOR_2 = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'

function valid(overrides: Partial<RawManifest> = {}): RawManifest {
  return {
    id: 'demo.app',
    name: 'Demo',
    version: '1.2.3',
    description: 'A demo miniapp',
    author: VALID_AUTHOR,
    permissions: ['account', 'sign'],
    ...overrides,
  }
}

describe('versionToNumber', () => {
  it('parses semver', () => {
    expect(versionToNumber('1.2.3')).toBe(1_002_003)
    expect(versionToNumber('0.0.1')).toBe(1)
    expect(versionToNumber('10.0.0')).toBe(10_000_000)
  })

  it('handles missing parts', () => {
    expect(versionToNumber('1')).toBe(1_000_000)
    expect(versionToNumber('1.2')).toBe(1_002_000)
  })

  it('returns 0 for garbage', () => {
    expect(versionToNumber('abc')).toBe(0)
    expect(versionToNumber('')).toBe(0)
  })
})

describe('parseManifest', () => {
  it('parses a valid manifest', () => {
    const m = parseManifestObject(valid())
    expect(m.id).toBe('demo.app')
    expect(m.name).toBe('Demo')
    expect(m.version).toBe(1_002_003)
    expect(m.versionText).toBe('1.2.3')
    expect(m.description).toBe('A demo miniapp')
    expect(m.author).toBe(VALID_AUTHOR)
    expect(m.permissions).toEqual(['account', 'sign'])
    expect(m.develop).toBe(false)
  })

  it('parses raw JSON string', () => {
    const json = JSON.stringify(valid())
    const m = parseManifest(json)
    expect(m.id).toBe('demo.app')
  })

  it('throws broken:manifest on invalid JSON', () => {
    expect(() => parseManifest('not json')).toThrow(ManifestParseError)
    try {
      parseManifest('not json')
    } catch (e) {
      expect((e as ManifestParseError).code).toBe('broken:manifest')
    }
  })

  it('normalizes id to [a-z0-9.]', () => {
    const m = parseManifestObject(valid({ id: 'My-App!@#.test' }))
    expect(m.id).toBe('myapp.test')
  })

  it('throws missing:id when id has no valid chars', () => {
    expect(() => parseManifestObject(valid({ id: '!!!' }))).toThrowError(
      expect.objectContaining({ code: 'missing:id' })
    )
  })

  it('strips control chars from name but preserves Unicode', () => {
    const m = parseManifestObject(valid({ name: 'Привет\x00Мир' }))
    expect(m.name).toBe('ПриветМир')
  })

  it('throws missing:name when name empty after sanitize', () => {
    expect(() => parseManifestObject(valid({ name: '\x00\x01\x02' }))).toThrowError(
      expect.objectContaining({ code: 'missing:name' })
    )
  })

  it('defaults version to 1.0.0 when omitted', () => {
    const raw = valid()
    delete raw.version
    const m = parseManifestObject(raw)
    expect(m.versionText).toBe('1.0.0')
    expect(m.version).toBe(1_000_000)
  })

  it('requires description or descriptions.en', () => {
    const raw = valid()
    delete raw.description
    expect(() => parseManifestObject(raw)).toThrowError(
      expect.objectContaining({ code: 'missing:description' })
    )
  })

  it('accepts only localized descriptions if en is present', () => {
    const raw = valid({ descriptions: { en: 'EN desc', ru: 'RU desc' } })
    delete raw.description
    const m = parseManifestObject(raw)
    expect(m.description).toBe('')
    expect(m.descriptions.en).toBe('EN desc')
    expect(m.descriptions.ru).toBe('RU desc')
  })

  it('rejects invalid bitcoin author', () => {
    expect(() => parseManifestObject(valid({ author: 'not-an-address' }))).toThrowError(
      expect.objectContaining({ code: 'broken:author' })
    )
  })

  it('accepts two distinct valid authors', () => {
    expect(parseManifestObject(valid({ author: VALID_AUTHOR_2 })).author).toBe(VALID_AUTHOR_2)
  })

  it('filters unknown permissions silently', () => {
    const m = parseManifestObject(valid({ permissions: ['account', 'unknownperm', 'sign'] }))
    expect(m.permissions).toEqual(['account', 'sign'])
  })

  it('rejects manifest with empty-string permission', () => {
    expect(() => parseManifestObject(valid({ permissions: ['account', '!!!'] }))).toThrowError(
      expect.objectContaining({ code: 'broken:permissions' })
    )
  })

  it('develop defaults to false (safer than legacy default-true)', () => {
    const m = parseManifestObject(valid())
    expect(m.develop).toBe(false)
  })

  it('develop honors explicit true', () => {
    expect(parseManifestObject(valid({ develop: true })).develop).toBe(true)
  })

  it('truncates over-long description (legacy compat — never throws on length)', () => {
    const huge = 'a'.repeat(5000)
    const raw = { ...valid(), description: huge } as RawManifest
    const m = parseManifestObject(raw)
    expect(m.description.length).toBe(2000)
  })

  it('truncates over-long name to 64 chars', () => {
    const raw = valid({ name: 'Demo' + 'x'.repeat(200) })
    const m = parseManifestObject(raw)
    expect(m.name.length).toBe(64)
  })

  it('preserves scope and start_url when present', () => {
    const m = parseManifestObject(valid({ scope: 'demo.bastyonapps.com', start_url: 'index.html' }))
    expect(m.scope).toBe('demo.bastyonapps.com')
    expect(m.startUrl).toBe('index.html')
  })

  it('defaults fetchHosts to empty when missing', () => {
    const m = parseManifestObject(valid())
    expect(m.fetchHosts).toEqual([])
  })

  it('normalizes fetch_hosts to URL origin', () => {
    const m = parseManifestObject(
      valid({
        fetch_hosts: [
          'https://API.example.com/path/ignored',
          'http://localhost:3000',
          ' https://api.example.com ', // дубль с пробелами — тоже origin
        ],
      } as RawManifest)
    )
    expect(m.fetchHosts).toContain('https://api.example.com')
    expect(m.fetchHosts).toContain('http://localhost:3000')
  })

  it('drops fetch_hosts with bad schemes / unparseable values', () => {
    const m = parseManifestObject(
      valid({
        fetch_hosts: ['javascript:alert(1)', 'ftp://x.com', '', 'not-a-url'],
      } as RawManifest)
    )
    expect(m.fetchHosts).toEqual([])
  })
})
