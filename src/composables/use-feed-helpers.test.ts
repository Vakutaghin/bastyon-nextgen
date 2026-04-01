import { describe, it, expect } from 'vitest'
import {
  safeDecode,
  normalizeImages,
  isUserVerified,
  calculateRatingStars,
  extractCommentMessage,
} from './use-feed-helpers'

describe('safeDecode', () => {
  it('returns empty string for falsy input', () => {
    expect(safeDecode('')).toBe('')
    expect(safeDecode(null as any)).toBe('')
    expect(safeDecode(undefined as any)).toBe('')
  })

  it('decodes URL-encoded string', () => {
    expect(safeDecode('hello%20world')).toBe('hello world')
  })

  it('decodes cyrillic', () => {
    expect(safeDecode('%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82')).toBe('Привет')
  })

  it('returns original string on decode error', () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
  })

  it('returns plain string unchanged', () => {
    expect(safeDecode('hello')).toBe('hello')
  })
})

describe('normalizeImages', () => {
  it('returns empty array for falsy input', () => {
    expect(normalizeImages(null)).toEqual([])
    expect(normalizeImages(undefined)).toEqual([])
    expect(normalizeImages('')).toEqual([])
  })

  it('wraps single string in array', () => {
    expect(normalizeImages('img.jpg')).toEqual(['img.jpg'])
  })

  it('returns string array as-is', () => {
    expect(normalizeImages(['a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
  })

  it('extracts url from objects', () => {
    expect(normalizeImages([{ url: 'a.jpg' }, { url: 'b.jpg' }])).toEqual(['a.jpg', 'b.jpg'])
  })

  it('filters out empty values', () => {
    expect(normalizeImages(['a.jpg', '', null])).toEqual(['a.jpg'])
  })

  it('handles mixed array', () => {
    expect(normalizeImages(['a.jpg', { url: 'b.jpg' }])).toEqual(['a.jpg', 'b.jpg'])
  })

  it('returns empty for non-string/non-array', () => {
    expect(normalizeImages(123)).toEqual([])
  })
})

describe('isUserVerified', () => {
  it('returns false for null', () => {
    expect(isUserVerified(null)).toBe(false)
  })

  it('returns true for "verificated" badge', () => {
    expect(isUserVerified({ badges: ['verificated'] })).toBe(true)
  })

  it('returns true for "verified" badge', () => {
    expect(isUserVerified({ badges: ['verified'] })).toBe(true)
  })

  it('returns true for flags.real = 1', () => {
    expect(isUserVerified({ flags: { real: 1 } })).toBe(true)
  })

  it('returns true for profile.real = "1"', () => {
    expect(isUserVerified({ real: '1' })).toBe(true)
  })

  it('returns true for profile.real = true', () => {
    expect(isUserVerified({ real: true })).toBe(true)
  })

  it('returns false for unverified profile', () => {
    expect(isUserVerified({ badges: [], flags: {} })).toBe(false)
  })
})

describe('calculateRatingStars', () => {
  it('returns 0 for zero count', () => {
    expect(calculateRatingStars(100, 0)).toBe(0)
  })

  it('returns 0 for NaN count', () => {
    expect(calculateRatingStars(100, NaN)).toBe(0)
  })

  it('calculates average correctly', () => {
    expect(calculateRatingStars(25, 5)).toBe(5)
  })

  it('clamps to max 5', () => {
    expect(calculateRatingStars(100, 1)).toBe(5)
  })

  it('clamps to min 0', () => {
    expect(calculateRatingStars(-100, 1)).toBe(0)
  })

  it('rounds to nearest 0.1', () => {
    expect(calculateRatingStars(7, 2)).toBe(3.5)
  })
})

describe('extractCommentMessage', () => {
  it('returns empty for falsy input', () => {
    expect(extractCommentMessage('')).toBe('')
    expect(extractCommentMessage(null as any)).toBe('')
  })

  it('extracts message from JSON', () => {
    expect(extractCommentMessage('{"message":"hello"}')).toBe('hello')
  })

  it('returns original string if not JSON', () => {
    expect(extractCommentMessage('plain text')).toBe('plain text')
  })

  it('returns original string if JSON has no message', () => {
    expect(extractCommentMessage('{"foo":"bar"}')).toBe('{"foo":"bar"}')
  })
})
