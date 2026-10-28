import { describe, it, expect } from 'vitest'
import { migrateLegacyImageHost, resolveImageUrl } from './url-transformer'

describe('migrateLegacyImageHost', () => {
  it('replaces old bastyon.com domain', () => {
    expect(migrateLegacyImageHost('https://bastyon.com:8092/i/abc')).toBe(
      'https://pocketnet.app:8092/i/abc'
    )
  })

  it('keeps pocketnet.app domain as-is', () => {
    const url = 'https://pocketnet.app:8092/i/abc'
    expect(migrateLegacyImageHost(url)).toBe(url)
  })

  it('returns empty string for empty input', () => {
    expect(migrateLegacyImageHost('')).toBe('')
  })

  it('returns non-matching URL as-is', () => {
    const url = 'https://example.com/image.jpg'
    expect(migrateLegacyImageHost(url)).toBe(url)
  })

  it('moves a retired PeerTube node to its archive', () => {
    expect(
      migrateLegacyImageHost('https://peertube341.pocketnet.app/images/a24b/a24b-original.jpg')
    ).toBe('https://peertube.archive.pocketnet.app/images/a24b/a24b-original.jpg')
    expect(migrateLegacyImageHost('https://peertube700.pocketnet.app/images/2ea1/x.jpg')).toBe(
      'https://peertube701.pocketnet.app/images/2ea1/x.jpg'
    )
  })

  it('keeps a working PeerTube node and a lookalike host', () => {
    const live = 'https://peertube800.pocketnet.app/images/eb5c/eb5c-original.jpg'
    expect(migrateLegacyImageHost(live)).toBe(live)
    const lookalike = 'https://evil.example/peertube341.pocketnet.app/x.jpg'
    expect(migrateLegacyImageHost(lookalike)).toBe(lookalike)
  })
})

describe('resolveImageUrl', () => {
  it('returns undefined for null/undefined', () => {
    expect(resolveImageUrl(null)).toBeUndefined()
    expect(resolveImageUrl(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(resolveImageUrl('')).toBeUndefined()
  })

  it('builds full URL from hash', () => {
    expect(resolveImageUrl('abc123')).toBe('https://pocketnet.app:8092/i/abc123')
  })

  it('normalizes http URL with old domain', () => {
    expect(resolveImageUrl('https://bastyon.com:8092/i/abc')).toBe(
      'https://pocketnet.app:8092/i/abc'
    )
  })

  it('keeps http URL with correct domain', () => {
    const url = 'https://pocketnet.app:8092/i/abc'
    expect(resolveImageUrl(url)).toBe(url)
  })

  it('keeps external http URL as-is', () => {
    const url = 'http://example.com/img.jpg'
    expect(resolveImageUrl(url)).toBe(url)
  })
})
