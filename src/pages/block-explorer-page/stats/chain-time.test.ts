import { describe, expect, it } from 'vitest'
import { dayToTime, heightToTime, hourToTime, timeToHeight } from './chain-time'

// Время блоков с ноды (getlastblocks [1, высота], 02.11.2026).
const KNOWN: Array<[number, number]> = [
  [1_000_000, 1610146832],
  [3_000_000, 1730105616],
  [4_000_000, 1788431552],
]

describe('chain time', () => {
  it('known blocks land on their time', () => {
    for (const [height, time] of KNOWN) expect(heightToTime(height)).toBe(time * 1000)
  })

  it('between anchors — within a quarter of an hour of the real block', () => {
    // Блок 4 089 600 вышел в 1793625424; опоры — 4 000 000 и вершина.
    const tip = [4_090_013, 1793650224] as const
    expect(Math.abs(heightToTime(4_089_600, tip) / 1000 - 1793625424)).toBeLessThan(900)
  })

  it('time back to height', () => {
    const tip = [4_090_013, 1793650224] as const
    for (const [height, time] of KNOWN) {
      expect(Math.abs(timeToHeight(time * 1000, tip) - height)).toBeLessThanOrEqual(1)
    }
    expect(timeToHeight(0)).toBe(1)
  })

  it('beyond the last anchor without a tip — a block per 57 s, as lately', () => {
    const t = heightToTime(4_001_440)
    expect(t - heightToTime(4_000_000)).toBeGreaterThan(22 * 3600_000)
    expect(t - heightToTime(4_000_000)).toBeLessThan(25 * 3600_000)
  })

  it('day and hour buckets of the node', () => {
    expect(dayToTime(2777)).toBe(heightToTime(2777 * 1440))
    expect(hourToTime(68166)).toBe(heightToTime(68166 * 60))
  })
})
