import { describe, expect, it } from 'vitest'
import { PIN_TAG, nextPinOrder, pinOrderFromTags, pinnedFirst } from './chat-pins'

describe('pinOrderFromTags', () => {
  it('порядок из метки m.favourite', () => {
    expect(PIN_TAG).toBe('m.favourite')
    expect(pinOrderFromTags({ 'm.favourite': { order: 0.25 } })).toBe(0.25)
  })

  it('метка без порядка — после упорядоченных', () => {
    expect(pinOrderFromTags({ 'm.favourite': {} })).toBe(1)
    expect(pinOrderFromTags({ 'm.favourite': { order: 'x' } })).toBe(1)
  })

  it('без метки — не закреплён', () => {
    expect(pinOrderFromTags(undefined)).toBeUndefined()
    expect(pinOrderFromTags({})).toBeUndefined()
    expect(pinOrderFromTags({ 'm.lowpriority': { order: 0.1 } })).toBeUndefined()
    expect(pinOrderFromTags({ 'm.favourite': null })).toBeUndefined()
  })
})

describe('nextPinOrder', () => {
  it('первый закреплённый — посередине, следующий — выше всех', () => {
    expect(nextPinOrder([{}, {}])).toBe(0.5)
    expect(nextPinOrder([{ pinned: 0.5 }, {}, { pinned: 0.8 }])).toBe(0.25)
  })

  it('ниже нуля, если выше уже некуда', () => {
    expect(nextPinOrder([{ pinned: 0 }])).toBe(-1)
  })
})

describe('pinnedFirst', () => {
  const pinOf = (x: { id: string; pin?: number }) => x.pin

  it('закреплённые сверху по порядку, остальные — как были', () => {
    const rows = [
      { id: 'a' },
      { id: 'b', pin: 0.5 },
      { id: 'c' },
      { id: 'd', pin: 0.25 },
      { id: 'e' },
    ]
    expect(pinnedFirst(rows, pinOf).map((r) => r.id)).toEqual(['d', 'b', 'a', 'c', 'e'])
  })

  it('равный порядок не переставляет', () => {
    const rows = [{ id: 'a', pin: 1 }, { id: 'b' }, { id: 'c', pin: 1 }]
    expect(pinnedFirst(rows, pinOf).map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('без закреплённых — тот же порядок', () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    expect(pinnedFirst(rows, pinOf)).toEqual(rows)
  })
})
