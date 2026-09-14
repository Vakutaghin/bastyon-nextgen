import { describe, it, expect } from 'vitest'
import {
  safeDecode,
  normalizeImages,
  isUserVerified,
  calculateRatingStars,
  extractCommentMessage,
} from './use-feed-helpers'

describe('safeDecode (реэкспорт канонического)', () => {
  it('decodes and keeps a literal plus', () => {
    expect(safeDecode('hello%20world')).toBe('hello world')
    expect(safeDecode('a%2Bb+c')).toBe('a+b+c')
    expect(safeDecode('')).toBe('')
  })
})

describe('normalizeImages', () => {
  const IMG = 'https://pocketnet.app:8092/i/'

  it('returns empty array for falsy input', () => {
    expect(normalizeImages(null)).toEqual([])
    expect(normalizeImages(undefined)).toEqual([])
    expect(normalizeImages('')).toEqual([])
  })

  it('wraps single string in array (bare hash is expanded to a full URL)', () => {
    expect(normalizeImages('abc123')).toEqual([`${IMG}abc123`])
  })

  it('keeps full URLs as-is', () => {
    expect(normalizeImages(['https://x/a.jpg', 'https://x/b.jpg'])).toEqual([
      'https://x/a.jpg',
      'https://x/b.jpg',
    ])
  })

  it('normalizes the legacy domain', () => {
    expect(normalizeImages(['https://bastyon.com:8092/i/h1'])).toEqual([`${IMG}h1`])
  })

  it('extracts url or src from objects', () => {
    expect(normalizeImages([{ url: 'https://x/a.jpg' }, { src: 'https://x/b.jpg' }])).toEqual([
      'https://x/a.jpg',
      'https://x/b.jpg',
    ])
  })

  it('filters out empty values', () => {
    expect(normalizeImages(['https://x/a.jpg', '', null, {}])).toEqual(['https://x/a.jpg'])
  })

  it('handles mixed array', () => {
    expect(normalizeImages(['h1', { url: 'https://x/b.jpg' }])).toEqual([
      `${IMG}h1`,
      'https://x/b.jpg',
    ])
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
