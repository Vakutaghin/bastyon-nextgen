import { describe, it, expect } from 'vitest'
import { aggregateStats, sumTotals, maxTotal } from './aggregate-stats'

describe('aggregateStats', () => {
  it('sorts buckets ascending by numeric key', () => {
    const out = aggregateStats({
      '64048': { '200': 1 },
      '64046': { '200': 2 },
      '64047': { '200': 3 },
    })
    expect(out.map((p) => p.bucket)).toEqual([64046, 64047, 64048])
  })

  it('categorizes tx types correctly', () => {
    const out = aggregateStats({
      '1': {
        '200': 10,    // content
        '204': 5,     // content
        '300': 20,    // ratings
        '301': 7,     // ratings
        '302': 3,     // subscriptions
        '100': 2,     // accounts
        '305': 1,     // moderation
        '99999': 4,   // other
      },
    })
    expect(out).toHaveLength(1)
    const p = out[0]
    expect(p.content).toBe(15)
    expect(p.ratings).toBe(27)
    expect(p.subscriptions).toBe(3)
    expect(p.accounts).toBe(2)
    expect(p.moderation).toBe(1)
    expect(p.other).toBe(4)
    expect(p.total).toBe(15 + 27 + 3 + 2 + 1 + 4)
  })

  it('handles empty / missing input', () => {
    expect(aggregateStats(null)).toEqual([])
    expect(aggregateStats(undefined)).toEqual([])
    expect(aggregateStats({})).toEqual([])
  })

  it('ignores negative or non-numeric counts', () => {
    const out = aggregateStats({
      '1': {
        '200': 10,
        '204': -3,
        '300': 0,
        '301': Number.NaN as unknown as number,
      },
    })
    expect(out[0].content).toBe(10)
    expect(out[0].ratings).toBe(0)
    expect(out[0].total).toBe(10)
  })

  it('matches real mainnet response shape', () => {
    // Уменьшенный пример с реальной ноды.
    const out = aggregateStats({
      '64046': {
        '1': 11, '100': 14, '103': 4, '104': 6,
        '200': 194, '201': 112, '204': 605, '205': 31,
        '300': 1885, '301': 1006, '302': 38, '303': 87,
      },
    })
    expect(out[0].content).toBe(194 + 112 + 605 + 31)
    expect(out[0].ratings).toBe(1885 + 1006)
    expect(out[0].subscriptions).toBe(38 + 87)
    expect(out[0].accounts).toBe(14 + 4 + 6)
    expect(out[0].other).toBe(11)
  })
})

describe('sumTotals / maxTotal', () => {
  it('computes sum and max over points', () => {
    const points = aggregateStats({
      '1': { '200': 10 },
      '2': { '200': 5 },
      '3': { '200': 20 },
    })
    expect(sumTotals(points)).toBe(35)
    expect(maxTotal(points)).toBe(20)
  })

  it('returns 0 for empty input', () => {
    expect(sumTotals([])).toBe(0)
    expect(maxTotal([])).toBe(0)
  })
})
