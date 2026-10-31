// Графический ключ как в Android: попадание по отрезку между событиями,
// середина прямой добавляется сама, ход конём соседей не задевает.

import { describe, expect, it } from 'vitest'
import { DOT_CENTER, hitsAlong, withPassThrough } from './pattern-geometry'

const at = (dot: number) => DOT_CENTER[dot]!

describe('hitsAlong', () => {
  it('касание точки и мимо', () => {
    expect(hitsAlong(at(4), at(4), [])).toEqual([4])
    expect(hitsAlong({ x: 100, y: 100 }, { x: 100, y: 100 }, [])).toEqual([])
  })

  it('быстрый росчерк через весь ряд — все точки по порядку', () => {
    expect(hitsAlong({ x: 20, y: 50 }, { x: 280, y: 50 }, [])).toEqual([0, 1, 2])
    expect(hitsAlong({ x: 280, y: 50 }, { x: 20, y: 50 }, [])).toEqual([2, 1, 0])
  })

  it('уже соединённые точки не повторяются', () => {
    expect(hitsAlong(at(0), at(8), [0, 4])).toEqual([8])
  })

  it('ход конём 0→5 соседние точки не задевает', () => {
    expect(hitsAlong(at(0), at(5), [0])).toEqual([5])
  })
})

describe('withPassThrough', () => {
  it('0→2 проходит через 1, 0→8 — через 4, 2→6 — через 4', () => {
    expect(withPassThrough([0], [2])).toEqual([1, 2])
    expect(withPassThrough([0], [8])).toEqual([4, 8])
    expect(withPassThrough([2], [6])).toEqual([4, 6])
  })

  it('середина уже в ключе — не добавляется второй раз', () => {
    expect(withPassThrough([1, 0], [2])).toEqual([2])
  })

  it('соседние точки и ход конём — без середины', () => {
    expect(withPassThrough([0], [1])).toEqual([1])
    expect(withPassThrough([0], [5])).toEqual([5])
  })

  it('первая точка ключа и повторы', () => {
    expect(withPassThrough([], [3])).toEqual([3])
    expect(withPassThrough([3], [3, 5])).toEqual([4, 5])
  })
})
