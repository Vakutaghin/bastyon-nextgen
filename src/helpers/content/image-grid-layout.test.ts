import { describe, expect, it } from 'vitest'
import {
  GRID_MAX_IMAGES,
  layoutImageGrid,
  type GridLayout,
  type GridTile,
} from './image-grid-layout'

const EPS = 1e-6

function tile(layout: GridLayout, i: number): GridTile {
  const t = layout.tiles[i]
  if (!t) throw new Error(`нет плитки ${i}`)
  return t
}

/** Плитки лежат в сетке, не наезжают друг на друга и покрывают её целиком. */
function expectTiled(layout: GridLayout): void {
  let area = 0
  for (const t of layout.tiles) {
    expect(t.x).toBeGreaterThanOrEqual(-EPS)
    expect(t.y).toBeGreaterThanOrEqual(-EPS)
    expect(t.x + t.w).toBeLessThanOrEqual(1 + EPS)
    expect(t.y + t.h).toBeLessThanOrEqual(layout.height + EPS)
    area += t.w * t.h
  }
  layout.tiles.forEach((a, i) =>
    layout.tiles.slice(i + 1).forEach((b) => {
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      expect(overlapX <= EPS || overlapY <= EPS).toBe(true)
    })
  )
  expect(area).toBeCloseTo(layout.height, 6)
}

describe('layoutImageGrid', () => {
  it('без картинок — пустая сетка', () => {
    expect(layoutImageGrid([])).toEqual({ height: 0, tiles: [] })
  })

  it('две квадратные — рядом, без обрезки', () => {
    const l = layoutImageGrid([1, 1])
    expect(l.tiles.map((t) => [t.x, t.y, t.w])).toEqual([
      [0, 0, 0.5],
      [0.5, 0, 0.5],
    ])
    expect(l.height).toBeCloseTo(0.5)
  })

  it('две широкие 16:9 — одна над другой', () => {
    const l = layoutImageGrid([16 / 9, 16 / 9])
    expect(tile(l, 0).w).toBe(1)
    expect(tile(l, 1).y).toBeCloseTo(tile(l, 0).h)
  })

  it('широкая и портрет рядом: ширины по пропорциям', () => {
    const l = layoutImageGrid([1.5, 0.75])
    expect(tile(l, 0).w).toBeCloseTo(2 / 3)
    expect(tile(l, 1).w).toBeCloseTo(1 / 3)
  })

  it('три горизонтальные — первая во всю ширину, две под ней', () => {
    const l = layoutImageGrid([1.5, 1.5, 1.5])
    expect(tile(l, 0)).toMatchObject({ x: 0, y: 0, w: 1 })
    expect(tile(l, 1).y).toBeCloseTo(tile(l, 0).h)
    expect(tile(l, 2).y).toBeCloseTo(tile(l, 0).h)
  })

  it('три вертикальные — первая большая слева, две столбиком справа', () => {
    const l = layoutImageGrid([0.75, 0.75, 0.75])
    expect(tile(l, 0)).toMatchObject({ x: 0, y: 0 })
    expect(tile(l, 0).h).toBeCloseTo(l.height)
    expect(tile(l, 1).x).toBeCloseTo(tile(l, 0).w)
    expect(tile(l, 2).x).toBeCloseTo(tile(l, 0).w)
  })

  it('четыре квадратные — 2×2', () => {
    const l = layoutImageGrid([1, 1, 1, 1])
    for (const t of l.tiles) {
      expect(t.w).toBeCloseTo(0.5)
      expect(t.h).toBeCloseTo(0.5)
    }
  })

  it('девять квадратных — 3×3', () => {
    const l = layoutImageGrid(Array(9).fill(1))
    expect(new Set(l.tiles.map((t) => t.y.toFixed(4))).size).toBe(3)
    expect(l.height).toBeCloseTo(1)
  })

  it('сетка не выше своей ширины и всегда покрыта целиком', () => {
    const sets = [
      [0.46, 0.46],
      [1.5, 0.75, 0.75],
      [0.66, 1.5, 1.5, 1.5],
      [1.5, 0.75, 1, 1.33, 0.66],
      [1.33, 0.75, 1.5, 1, 0.66, 1.78, 1],
      Array(10).fill(0.75),
      [4, 0.3, 1, 2.5, 0.5, 1],
    ]
    for (const ratios of sets) {
      const l = layoutImageGrid(ratios)
      expect(l.tiles).toHaveLength(ratios.length)
      expect(l.height).toBeLessThanOrEqual(1 + EPS)
      expectTiled(l)
    }
  })

  it('неизвестные пропорции считаются квадратом', () => {
    expect(layoutImageGrid([undefined, 0, Number.NaN, 1])).toEqual(layoutImageGrid([1, 1, 1, 1]))
  })

  it(`больше ${GRID_MAX_IMAGES} — раскладывает первые ${GRID_MAX_IMAGES}`, () => {
    const l = layoutImageGrid(Array(14).fill(1))
    expect(l.tiles).toHaveLength(GRID_MAX_IMAGES)
    expectTiled(l)
  })
})
