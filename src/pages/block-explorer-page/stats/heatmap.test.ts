import { describe, expect, it } from 'vitest'
import { heatLevel, heatmapCells } from './heatmap'

describe('activity heatmap', () => {
  it('cells by local weekday and hour, averaged', () => {
    const tuesday3pm = new Date(2026, 9, 27, 15, 0).getTime()
    const hour = 3_600_000
    const point = (t: number, n: number) => ({ t, end: t + hour, counts: { '300': n }, parts: 1 })
    const cells = heatmapCells([point(tuesday3pm, 10), point(tuesday3pm + 7 * 24 * hour, 30)])
    expect(cells).toHaveLength(7 * 24)
    expect(cells.find((c) => c.weekday === 1 && c.hour === 15)!.value).toBe(20)
    expect(cells.find((c) => c.weekday === 0 && c.hour === 0)!.value).toBeNull()
  })

  it('levels from 1 to 8, no data — 0', () => {
    expect(heatLevel(null, 0, 10)).toBe(0)
    expect(heatLevel(0, 0, 10)).toBe(1)
    expect(heatLevel(10, 0, 10)).toBe(8)
    expect(heatLevel(5, 5, 5)).toBe(4)
  })
})
