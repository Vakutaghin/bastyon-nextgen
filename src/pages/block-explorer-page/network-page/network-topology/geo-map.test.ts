// Карта схемы сети: проекция как у подложки, камера MapLibre показывает то же,
// что видно на схеме, ноды одного города не налезают друг на друга.

import { describe, expect, it } from 'vitest'
import { landPoints, mercator, spreadOffset, viewToCamera, WORLD } from './geo-map'

describe('mercator', () => {
  it('нулевой меридиан и экватор — середина мира; север — сверху', () => {
    expect(mercator(0, 0)).toEqual({ x: WORLD / 2, y: WORLD / 2 })
    const moscow = mercator(55.75, 37.62)
    expect(moscow.x).toBeCloseTo(WORLD * 0.6045, 3)
    expect(moscow.y).toBeLessThan(WORLD / 2)
    expect(mercator(90, 0).y).toBeCloseTo(0, 6)
  })
})

describe('spreadOffset', () => {
  it('первая — в точке города, остальные — вокруг и не ближе шага', () => {
    expect(spreadOffset(0, 8)).toEqual({ dx: 0, dy: 0 })
    const points = Array.from({ length: 20 }, (_, i) => spreadOffset(i, 8))
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i]!.dx - points[j]!.dx, points[i]!.dy - points[j]!.dy)
        expect(d).toBeGreaterThan(6)
      }
    }
  })
})

describe('viewToCamera', () => {
  it('середина окна — та же точка мира; уровень MapLibre на 1 меньше log2(k)', () => {
    const moscow = mercator(55.75, 37.62)
    const k = 2 ** 6
    // Москва в середине окна 800×600.
    const view = { x: 400 - moscow.x * k, y: 300 - moscow.y * k, k }
    const { center, zoom } = viewToCamera(view, 800, 600)
    expect(center[0]).toBeCloseTo(37.62, 6)
    expect(center[1]).toBeCloseTo(55.75, 6)
    expect(zoom).toBeCloseTo(5, 9)
  })
})

describe('landPoints', () => {
  it('суша — внутри мира, Евразия на месте', () => {
    const points = landPoints()
    expect(points.length).toBeGreaterThan(3000)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(WORLD)
    }
    const moscow = mercator(55.75, 37.62)
    const near = points.some((p) => Math.hypot(p.x - moscow.x, p.y - moscow.y) < 2)
    expect(near).toBe(true)
  })
})
