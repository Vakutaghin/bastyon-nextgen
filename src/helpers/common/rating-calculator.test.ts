import { describe, it, expect } from 'vitest'
import { calculateRatingUpdate } from './rating-calculator'

describe('calculateRatingUpdate', () => {
  it('increments scoreCnt and adds to scoreSum on first vote (oldMyVal=0)', () => {
    const result = calculateRatingUpdate(0, 5, 10, 3)
    expect(result).toEqual({ myVal: 5, scoreSum: 15, scoreCnt: 4 })
  })

  it('keeps scoreCnt and adjusts scoreSum on changed vote', () => {
    const result = calculateRatingUpdate(3, 5, 10, 3)
    expect(result).toEqual({ myVal: 5, scoreSum: 12, scoreCnt: 3 })
  })

  it('handles downvote (negative newMyVal) on first vote', () => {
    const result = calculateRatingUpdate(0, -1, 10, 5)
    expect(result).toEqual({ myVal: -1, scoreSum: 9, scoreCnt: 6 })
  })

  it('handles changing from positive to negative vote', () => {
    const result = calculateRatingUpdate(4, -1, 20, 5)
    expect(result).toEqual({ myVal: -1, scoreSum: 15, scoreCnt: 5 })
  })

  it('handles zero values for currentScoreSum and currentScoreCnt', () => {
    const result = calculateRatingUpdate(0, 5, 0, 0)
    expect(result).toEqual({ myVal: 5, scoreSum: 5, scoreCnt: 1 })
  })

  it('handles changing vote to same value (no-op on sum)', () => {
    const result = calculateRatingUpdate(3, 3, 10, 5)
    expect(result).toEqual({ myVal: 3, scoreSum: 10, scoreCnt: 5 })
  })
})
