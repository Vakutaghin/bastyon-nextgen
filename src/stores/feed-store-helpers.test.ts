import { describe, it, expect } from 'vitest'
import {
  extractPostsFromApiResponse,
  calculateRatingStars,
  isUserVerified,
} from './feed-store-helpers'

// --- extractPostsFromApiResponse ---

describe('extractPostsFromApiResponse', () => {
  it('returns empty array for null/undefined', () => {
    expect(extractPostsFromApiResponse(null)).toEqual([])
    expect(extractPostsFromApiResponse(undefined)).toEqual([])
  })

  it('returns array as-is', () => {
    const posts = [{ id: 1 }, { id: 2 }]
    expect(extractPostsFromApiResponse(posts)).toBe(posts)
  })

  it('unwraps { data: { contents: [...] } }', () => {
    const contents = [{ id: 1 }]
    expect(extractPostsFromApiResponse({ data: { contents } })).toBe(contents)
  })

  it('unwraps { data: [...] }', () => {
    const data = [{ id: 1 }]
    expect(extractPostsFromApiResponse({ data })).toBe(data)
  })

  it('unwraps { result: [...] }', () => {
    const result = [{ id: 1 }]
    expect(extractPostsFromApiResponse({ result })).toBe(result)
  })

  it('unwraps { data: { data: [...] } }', () => {
    const inner = [{ id: 1 }]
    expect(extractPostsFromApiResponse({ data: { data: inner } })).toBe(inner)
  })

  it('returns empty array for unknown shape', () => {
    expect(extractPostsFromApiResponse({ foo: 'bar' })).toEqual([])
  })
})

// --- calculateRatingStars ---

describe('calculateRatingStars', () => {
  it('returns 0 when count is 0', () => {
    expect(calculateRatingStars(100, 0)).toBe(0)
  })

  it('returns 0 when count is falsy', () => {
    expect(calculateRatingStars(100, NaN)).toBe(0)
  })

  it('calculates average and rounds', () => {
    // avg = 25 / 5 = 5.0 → clamped to 5
    expect(calculateRatingStars(25, 5)).toBe(5)
  })

  it('clamps to max 5', () => {
    expect(calculateRatingStars(100, 1)).toBe(5)
  })

  it('clamps to min 0', () => {
    expect(calculateRatingStars(-100, 1)).toBe(0)
  })

  it('rounds to nearest 0.1', () => {
    // avg = 7 / 2 = 3.5 → round(3.5 * 10) / 10 = 3.5
    expect(calculateRatingStars(7, 2)).toBe(3.5)
  })
})

// --- isUserVerified ---

describe('isUserVerified', () => {
  it('returns false for null profile', () => {
    expect(isUserVerified(null)).toBe(false)
  })

  it('returns true if badges include "verificated"', () => {
    expect(isUserVerified({ badges: ['verificated'] })).toBe(true)
  })

  it('returns true if badges include "verified"', () => {
    expect(isUserVerified({ badges: ['verified'] })).toBe(true)
  })

  it('returns true if flags.real === 1', () => {
    expect(isUserVerified({ flags: { real: 1 } })).toBe(true)
  })

  it('returns true if profile.real === "1"', () => {
    expect(isUserVerified({ real: '1' })).toBe(true)
  })

  it('returns true if profile.real === true', () => {
    expect(isUserVerified({ real: true })).toBe(true)
  })

  it('returns false for unverified profile', () => {
    expect(isUserVerified({ badges: [], flags: {} })).toBe(false)
  })
})
