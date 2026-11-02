import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  GENESIS_MS,
  customRange,
  defaultGranularity,
  granularityOptions,
  presetRange,
} from './stats-period'

const NOW = new Date(2026, 10, 2, 12).getTime()

describe('stats period', () => {
  it('presets', () => {
    expect(presetRange('7d', NOW)).toEqual({ from: NOW - 7 * DAY_MS, to: NOW })
    expect(new Date(presetRange('6m', NOW).from).getMonth()).toBe(4)
    expect(new Date(presetRange('3y', NOW).from).getFullYear()).toBe(2023)
    expect(presetRange('all', NOW).from).toBe(GENESIS_MS)
  })

  it('custom range — whole days, not before the first block or after now', () => {
    const r = customRange(
      new Date(2026, 9, 10, 18).getTime(),
      new Date(2026, 9, 1, 9).getTime(),
      NOW
    )
    expect(new Date(r.from)).toEqual(new Date(2026, 9, 1))
    expect(new Date(r.to)).toEqual(new Date(2026, 9, 11))
    expect(customRange(0, NOW + 5 * DAY_MS, NOW)).toEqual({ from: GENESIS_MS, to: NOW })
  })

  it('hours only inside the last week; steps by length', () => {
    expect(granularityOptions(presetRange('2d', NOW), NOW)).toEqual(['hour'])
    expect(granularityOptions(presetRange('7d', NOW), NOW)).toEqual(['hour', 'day'])
    expect(granularityOptions(presetRange('30d', NOW), NOW)).toEqual(['day', 'week'])
    expect(granularityOptions(presetRange('1y', NOW), NOW)).toEqual(['day', 'week', 'month'])
    expect(granularityOptions(presetRange('all', NOW), NOW)).toEqual(['week', 'month'])
    const oldWeek = customRange(NOW - 40 * DAY_MS, NOW - 38 * DAY_MS, NOW)
    expect(granularityOptions(oldWeek, NOW)).toEqual(['day'])
  })

  it('default step', () => {
    expect(defaultGranularity(presetRange('2d', NOW), NOW)).toBe('hour')
    expect(defaultGranularity(presetRange('7d', NOW), NOW)).toBe('day')
    expect(defaultGranularity(presetRange('30d', NOW), NOW)).toBe('day')
    expect(defaultGranularity(presetRange('1y', NOW), NOW)).toBe('week')
    expect(defaultGranularity(presetRange('all', NOW), NOW)).toBe('month')
  })
})
