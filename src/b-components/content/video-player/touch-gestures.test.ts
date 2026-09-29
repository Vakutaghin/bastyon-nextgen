import { describe, it, expect } from 'vitest'
import { DOUBLE_TAP_MS, SEEK_CONTINUE_MS, TapTracker, tapZone } from './touch-gestures'

describe('tapZone', () => {
  it('splits the video into thirds', () => {
    expect(tapZone(10, 300)).toBe('left')
    expect(tapZone(150, 300)).toBe('center')
    expect(tapZone(290, 300)).toBe('right')
    expect(tapZone(10, 0)).toBe('center')
  })
})

describe('TapTracker', () => {
  it('a single side tap waits for a second one, then counts as a single tap', () => {
    const t = new TapTracker()
    expect(t.tap('right', 0)).toEqual({ kind: 'wait' })
    expect(t.settle(DOUBLE_TAP_MS - 1)).toBe(false)
    expect(t.settle(DOUBLE_TAP_MS)).toBe(true)
    // Уже решено — второй раз не срабатывает.
    expect(t.settle(DOUBLE_TAP_MS + 50)).toBe(false)
  })

  it('a double tap on a side seeks, and the pending single tap is swallowed', () => {
    const t = new TapTracker()
    t.tap('left', 0)
    expect(t.tap('left', 200)).toEqual({ kind: 'seek', direction: -1 })
    expect(t.settle(1000)).toBe(false)
  })

  it('keeps seeking with every further tap while they come quickly', () => {
    const t = new TapTracker()
    t.tap('right', 0)
    expect(t.tap('right', 150)).toEqual({ kind: 'seek', direction: 1 })
    expect(t.tap('right', 150 + SEEK_CONTINUE_MS - 1)).toEqual({ kind: 'seek', direction: 1 })
    // Пауза длиннее — серия кончилась, снова нужно двойное касание.
    const later = 150 + 2 * SEEK_CONTINUE_MS + 10
    expect(t.isSeeking(later)).toBe(false)
    expect(t.tap('right', later)).toEqual({ kind: 'wait' })
  })

  it('during a series the other side seeks the other way at once', () => {
    const t = new TapTracker()
    t.tap('right', 0)
    t.tap('right', 100)
    expect(t.tap('left', 300)).toEqual({ kind: 'seek', direction: -1 })
  })

  it('the middle toggles the controls at once and ends a series', () => {
    const t = new TapTracker()
    t.tap('right', 0)
    t.tap('right', 100)
    expect(t.tap('center', 200)).toEqual({ kind: 'toggle' })
    expect(t.isSeeking(250)).toBe(false)
  })

  it('taps on different sides are not a double tap', () => {
    const t = new TapTracker()
    t.tap('left', 0)
    expect(t.tap('right', 100)).toEqual({ kind: 'wait' })
    // Первое касание перекрыто вторым: одно показывание панели на двоих.
    expect(t.settle(250)).toBe(false)
    expect(t.settle(100 + DOUBLE_TAP_MS)).toBe(true)
  })
})
