import { describe, it, expect } from 'vitest'

import { calculateAverageRating, decodeUrlEncoded, getPostShareId } from './helpers'

describe('decodeUrlEncoded', () => {
  it('декодирует %XX и не трогает строки без кодирования', () => {
    expect(decodeUrlEncoded('%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82')).toBe('Привет')
    expect(decodeUrlEncoded('plain title')).toBe('plain title')
  })
  it('плюс остаётся плюсом (encodeURIComponent-семантика)', () => {
    expect(decodeUrlEncoded('a%2Bb+c')).toBe('a+b+c')
  })
  it('битая последовательность → исходная строка; пустое → как есть', () => {
    expect(decodeUrlEncoded('%E0%A4%A')).toBe('%E0%A4%A')
    expect(decodeUrlEncoded('')).toBe('')
  })
  it('стабилен при повторных вызовах (регексп без g-флага)', () => {
    for (let i = 0; i < 5; i++) expect(decodeUrlEncoded('x%20y')).toBe('x y')
  })
})

describe('calculateAverageRating', () => {
  it('готовое ratingStars имеет приоритет, даже 0', () => {
    expect(calculateAverageRating(4.2, 100, 10)).toBe(4.2)
    expect(calculateAverageRating(0, 100, 10)).toBe(0)
  })
  it('считает среднее с округлением до 0.1 и клампом 0..5', () => {
    expect(calculateAverageRating(undefined, 7, 2)).toBe(3.5)
    expect(calculateAverageRating(null, 123, 10)).toBe(5)
    expect(calculateAverageRating(undefined, -3, 2)).toBe(0)
  })
  it('без оценок → 0', () => {
    expect(calculateAverageRating(undefined, undefined, 0)).toBe(0)
    expect(calculateAverageRating(undefined, 10, undefined)).toBe(0)
    expect(calculateAverageRating(undefined, undefined, 3)).toBe(0)
  })
})

describe('getPostShareId (K5)', () => {
  it('отредактированный пост: txid оригинала, а не hash правки', () => {
    expect(getPostShareId({ txid: 'orig', hash: 'edit', id: 7 })).toBe('orig')
  })
  it('без txid — hash, без hash — числовой id строкой, ничего — пустая строка', () => {
    expect(getPostShareId({ hash: 'h', id: 7 })).toBe('h')
    expect(getPostShareId({ id: 7 })).toBe('7')
    expect(getPostShareId({})).toBe('')
  })
})
