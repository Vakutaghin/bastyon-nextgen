import { describe, it, expect } from 'vitest'
import { resolveAvatarUrl } from './avatar-resolver'

describe('resolveAvatarUrl', () => {
  it('returns undefined for null/undefined', () => {
    expect(resolveAvatarUrl(null)).toBeUndefined()
    expect(resolveAvatarUrl(undefined)).toBeUndefined()
  })

  it('returns undefined for empty profile', () => {
    expect(resolveAvatarUrl({})).toBeUndefined()
  })

  it('uses accSet.image as priority', () => {
    const profile = {
      accSet: { image: 'hash123' },
      i: 'other_hash',
    }
    expect(resolveAvatarUrl(profile)).toBe('https://pocketnet.app:8092/i/hash123')
  })

  it('falls back to "i" field', () => {
    expect(resolveAvatarUrl({ i: 'hash456' }))
      .toBe('https://pocketnet.app:8092/i/hash456')
  })

  it('falls back to "avatar" field', () => {
    expect(resolveAvatarUrl({ avatar: 'hash789' }))
      .toBe('https://pocketnet.app:8092/i/hash789')
  })

  it('falls back to "image" field', () => {
    expect(resolveAvatarUrl({ image: 'hashABC' }))
      .toBe('https://pocketnet.app:8092/i/hashABC')
  })

  it('handles full URL in avatar field', () => {
    const url = 'https://pocketnet.app:8092/i/hash'
    expect(resolveAvatarUrl({ avatar: url })).toBe(url)
  })

  it('normalizes old domain URL', () => {
    expect(resolveAvatarUrl({ i: 'https://bastyon.com:8092/i/hash' }))
      .toBe('https://pocketnet.app:8092/i/hash')
  })

  it('skips non-string values', () => {
    expect(resolveAvatarUrl({ i: 123, avatar: null, image: 'hash' }))
      .toBe('https://pocketnet.app:8092/i/hash')
  })
})
