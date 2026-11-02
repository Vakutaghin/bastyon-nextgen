import { describe, expect, it, vi } from 'vitest'

vi.mock('@/helpers/api/request', () => ({ rpcCall: vi.fn() }))

import { normalizePostScores, scoreDistribution, sortPostScores, withOwnScore } from './post-scores'

// Как отвечает нода (getpostscores, 02.11.2026): у кого-то нет аватара и репутации.
const RAW = [
  {
    address: 'PVera',
    name: 'Vera__',
    avatar: 'https://bastyon.com:8092/i/a.jfif',
    reputation: 69192,
    value: 5,
  },
  { address: 'PWorld', name: 'WorldsDNC', reputation: 3834, value: 4 },
  { address: 'PDod', name: 'DodJ26', value: 5 },
  { address: 'PVera', name: 'Vera__', value: 1 },
  { address: 'PBad', value: 9 },
  { name: 'nobody', value: 3 },
]

describe('post scores', () => {
  it('normalizes the node list: one row per person, only 1…5 stars', () => {
    const rows = normalizePostScores(RAW)
    expect(rows.map((r) => [r.address, r.value])).toEqual([
      ['PVera', 5],
      ['PWorld', 4],
      ['PDod', 5],
    ])
    expect(rows[0]).toMatchObject({ name: 'Vera__', reputation: 69192 })
    expect(rows[0]!.avatar).toMatch(/\/i\/a\.jfif$/)
    expect(rows[2]).toMatchObject({ avatar: null, reputation: null })
    expect(normalizePostScores(null)).toEqual([])
  })

  it('subscriptions first, then by reputation', () => {
    const rows = normalizePostScores(RAW)
    const sorted = sortPostScores(rows, (a) => a === 'PDod')
    expect(sorted.map((r) => r.address)).toEqual(['PDod', 'PVera', 'PWorld'])
  })

  it('adds my own score while the node does not have it yet', () => {
    const rows = normalizePostScores(RAW)
    const me = { address: 'PMe', name: 'me', avatar: null, value: 3 }
    expect(withOwnScore(rows, me).map((r) => r.address)).toContain('PMe')
    expect(withOwnScore(rows, { ...me, address: 'PVera' })).toHaveLength(3)
    expect(withOwnScore(rows, null)).toHaveLength(3)
  })

  it('shares from 5 down to 1', () => {
    const shares = scoreDistribution(normalizePostScores(RAW))
    expect(shares.map((s) => [s.stars, s.count, s.percent])).toEqual([
      [5, 2, 67],
      [4, 1, 33],
      [3, 0, 0],
      [2, 0, 0],
      [1, 0, 0],
    ])
  })
})
