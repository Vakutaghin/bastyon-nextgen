import { describe, it, expect } from 'vitest'
import { generateCacheHash } from './cache-hash'

describe('generateCacheHash', () => {
  it('returns a non-empty string', () => {
    const hash = generateCacheHash()
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('generates unique values', () => {
    const hashes = new Set(Array.from({ length: 100 }, () => generateCacheHash()))
    expect(hashes.size).toBe(100)
  })

  it('contains only valid base36 characters', () => {
    const hash = generateCacheHash()
    expect(hash).toMatch(/^[0-9a-z.]+$/)
  })
})
