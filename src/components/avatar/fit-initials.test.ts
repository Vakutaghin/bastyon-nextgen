// Инициалы в круге, как у antd Avatar: влезают с зазором 4px — масштаб 1,
// нет — ужимаются ровно до круга минус зазоры.

import { describe, expect, it } from 'vitest'
import { fitScale } from './fit-initials'

describe('fitScale', () => {
  it('влезает — без масштаба', () => {
    expect(fitScale(12, 32)).toBe(1)
    expect(fitScale(24, 32)).toBe(1)
  })

  it('не влезает — до (круг − 8) / ширина, как antd', () => {
    expect(fitScale(26, 32)).toBeCloseTo(24 / 26)
    expect(fitScale(26, 16)).toBeCloseTo(8 / 26)
  })

  it('пустая строка или круг меньше зазоров — без масштаба', () => {
    expect(fitScale(0, 32)).toBe(1)
    expect(fitScale(20, 8)).toBe(1)
  })
})
