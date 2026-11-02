import { describe, expect, it } from 'vitest'
import { dayToTime } from './chain-time'
import {
  ACTIVITY_SERIES,
  ENGAGEMENT_SERIES,
  bucketsToPoints,
  coveredDays,
  groupPoints,
  periodStart,
  toChartPoints,
  type Buckets,
} from './stats-model'

// Сутки 2839 с ноды (getstatisticbydays, 02.11.2026), без пары мелких типов.
const DAY_2839 = {
  '1': 214,
  '100': 241,
  '103': 80,
  '104': 32,
  '200': 2893,
  '201': 1240,
  '202': 44,
  '204': 8360,
  '205': 338,
  '208': 40,
  '210': 65,
  '211': 8,
  '220': 46,
  '300': 19292,
  '301': 10941,
  '302': 594,
  '303': 760,
}

describe('stats model', () => {
  it('buckets in time order, junk dropped', () => {
    const raw = { '2839': DAY_2839, '2838': { '200': '5', '300': -1 }, x: {} } as unknown as Buckets
    const points = bucketsToPoints(raw, 'day')
    expect(points.map((p) => p.t)).toEqual([dayToTime(2838), dayToTime(2839)])
    expect(points[0]!.counts).toEqual({ '200': 5 })
    expect(points[1]!.end).toBe(dayToTime(2840))
  })

  it('activity categories add up to every transaction', () => {
    const [point] = toChartPoints(
      bucketsToPoints({ '2839': DAY_2839 }, 'day'),
      ACTIVITY_SERIES,
      'day',
      'day'
    )
    const v = point!.values
    expect(v).toMatchObject({
      publications: 2893 + 1240 + 44 + 65 + 46,
      comments: 8360 + 338,
      ratings: 19292 + 10941,
      subscriptions: 594 + 760,
      profiles: 241 + 80,
      transfers: 214,
      other: 32 + 40 + 8,
    })
    const total = Object.values(DAY_2839).reduce((s, n) => s + n, 0)
    expect(Object.values(v).reduce<number>((s, n) => s + (n ?? 0), 0)).toBe(total)
  })

  it('engagement per publication; no publications — no value', () => {
    const points = bucketsToPoints({ '1': DAY_2839, '2': { '204': 3 } }, 'day')
    const [day, empty] = toChartPoints(points, ENGAGEMENT_SERIES, 'day', 'day', true)
    expect(day!.values.commentsPerPublication).toBeCloseTo(8360 / 4288)
    expect(empty!.values.commentsPerPublication).toBeNull()
  })

  it('weeks from Monday by the middle of a node day, averaged per day', () => {
    const monday = new Date(2026, 9, 26, 1).getTime()
    expect(new Date(periodStart(monday + 3 * 86_400_000, 'week')).getDate()).toBe(26)
    const days = Array.from({ length: 10 }, (_, i) => ({
      t: monday + i * 86_400_000,
      end: monday + (i + 1) * 86_400_000,
      counts: { '200': 7 },
      parts: 1,
    }))
    const weeks = groupPoints(days, 'week', 'day')
    expect(weeks.map((w) => w.parts)).toEqual([7, 3])
    const chart = toChartPoints(weeks, ACTIVITY_SERIES, 'week', 'day')
    expect(chart.map((p) => p.values.publications)).toEqual([7, 7])
    expect(coveredDays(weeks, 'day')).toBe(10)
  })

  it('hours into calendar days', () => {
    const start = new Date(2026, 9, 27, 0, 0).getTime()
    const hours = Array.from({ length: 30 }, (_, i) => ({
      t: start + i * 3_600_000,
      end: start + (i + 1) * 3_600_000,
      counts: { '1': 1 },
      parts: 1,
    }))
    const days = groupPoints(hours, 'day', 'hour')
    expect(days.map((d) => d.counts['1'])).toEqual([24, 6])
    expect(coveredDays(hours, 'hour')).toBe(30 / 24)
  })
})
