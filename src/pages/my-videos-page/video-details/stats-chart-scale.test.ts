// Геометрия графиков статистики: круглые деления, подписи по X без наложений,
// столбик со скруглённой вершиной.

import { describe, expect, it } from 'vitest'

import { columnPath, labelIndexes, niceTicks, sampleEvenly } from './stats-chart-scale'

describe('niceTicks', () => {
  it('шаг 1, 2 или 5 × 10ⁿ от нуля до круглого максимума', () => {
    expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40])
    expect(niceTicks(3)).toEqual([0, 1, 2, 3])
    expect(niceTicks(1240)).toEqual([0, 500, 1000, 1500])
  })

  it('у целых величин шаг не дробный; дробные — как есть', () => {
    expect(niceTicks(1)).toEqual([0, 1])
    expect(niceTicks(1.6, 4, false)).toEqual([0, 0.5, 1, 1.5, 2])
  })

  it('пусто — ось от 0 до 1', () => {
    expect(niceTicks(0)).toEqual([0, 1])
  })
})

describe('labelIndexes', () => {
  it('первая и последняя — всегда, между ними — сколько влезет', () => {
    expect(labelIndexes(28, 600)).toEqual([0, 5, 11, 16, 22, 27])
    expect(labelIndexes(28, 150)).toEqual([0, 27])
    expect(labelIndexes(3, 1000)).toEqual([0, 1, 2])
    expect(labelIndexes(1, 600)).toEqual([0])
    expect(labelIndexes(0, 600)).toEqual([])
  })
})

describe('columnPath', () => {
  it('скругление сверху не больше 4 px и не больше половины столбика', () => {
    expect(columnPath(10, 20, 50, 100)).toBe('M10,100 V54 Q10,50 14,50 H26 Q30,50 30,54 V100 Z')
    expect(columnPath(0, 4, 98, 100)).toBe('M0,100 V100 Q0,98 2,98 H2 Q4,98 4,100 V100 Z')
    expect(columnPath(0, 10, 100, 100)).toBe('')
  })
})

describe('sampleEvenly', () => {
  it('короткий ряд — целиком, длинный — поровну с краями', () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3])
    const sampled = sampleEvenly(
      Array.from({ length: 100 }, (_, i) => i),
      5
    )
    expect(sampled[0]).toBe(0)
    expect(sampled[sampled.length - 1]).toBe(99)
    expect(sampled).toHaveLength(5)
  })
})
