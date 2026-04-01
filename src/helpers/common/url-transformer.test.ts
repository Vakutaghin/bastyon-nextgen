import { describe, it, expect } from 'vitest'
import { normalizeImageUrl, resolveImageUrl } from './url-transformer'

describe('normalizeImageUrl', () => {
  it('replaces old bastyon.com domain', () => {
    expect(normalizeImageUrl('https://bastyon.com:8092/i/abc'))
      .toBe('https://pocketnet.app:8092/i/abc')
  })

  it('keeps pocketnet.app domain as-is', () => {
    const url = 'https://pocketnet.app:8092/i/abc'
    expect(normalizeImageUrl(url)).toBe(url)
  })

  it('returns empty string for empty input', () => {
    expect(normalizeImageUrl('')).toBe('')
  })

  it('returns non-matching URL as-is', () => {
    const url = 'https://example.com/image.jpg'
    expect(normalizeImageUrl(url)).toBe(url)
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
    expect(resolveImageUrl('abc123'))
      .toBe('https://pocketnet.app:8092/i/abc123')
  })

  it('normalizes http URL with old domain', () => {
    expect(resolveImageUrl('https://bastyon.com:8092/i/abc'))
      .toBe('https://pocketnet.app:8092/i/abc')
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
