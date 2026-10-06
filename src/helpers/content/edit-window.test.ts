import { describe, expect, it } from 'vitest'

import { EDIT_WINDOW_MS, isWithinEditWindow } from './edit-window'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 6)

describe('срок правки', () => {
  it('свежий пост и пост недельной давности править можно', () => {
    expect(isWithinEditWindow(now - 60_000, now)).toBe(true)
    expect(isWithinEditWindow(now - 7 * DAY, now)).toBe(true)
  })

  it('через сутки править ещё можно: сутки были до высоты 2 930 000', () => {
    expect(isWithinEditWindow(now - 2 * DAY, now)).toBe(true)
  })

  it('после 28 суток кнопки нет: нода примет правку только в пределах 43 200 блоков', () => {
    expect(isWithinEditWindow(now - EDIT_WINDOW_MS, now)).toBe(true)
    expect(isWithinEditWindow(now - 29 * DAY, now)).toBe(false)
    expect(isWithinEditWindow(now - 120 * DAY, now)).toBe(false)
  })

  it('неизвестное время кнопку не прячет', () => {
    expect(isWithinEditWindow(Number.NaN, now)).toBe(true)
    expect(isWithinEditWindow(0, now)).toBe(true)
  })
})
