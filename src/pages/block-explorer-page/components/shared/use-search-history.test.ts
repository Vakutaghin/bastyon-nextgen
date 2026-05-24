import { describe, it, expect, beforeEach } from 'vitest'
import { recordVisit, removeEntry, clearHistory, useSearchHistory } from './use-search-history'

beforeEach(() => {
  clearHistory()
  if (typeof window !== 'undefined') {
    try { window.localStorage.clear() } catch { /* test env */ }
  }
})

describe('search history', () => {
  it('records a visit and lists it in history', () => {
    recordVisit('0e8fbe55', 'block')
    const { history } = useSearchHistory()
    expect(history.value).toHaveLength(1)
    expect(history.value[0]?.value).toBe('0e8fbe55')
    expect(history.value[0]?.kind).toBe('block')
    expect(history.value[0]?.hits).toBe(1)
  })

  it('trims whitespace and ignores empty values', () => {
    recordVisit('   abc  ', 'tx')
    recordVisit('', 'block')
    recordVisit('   ', 'address')
    const { history } = useSearchHistory()
    expect(history.value).toHaveLength(1)
    expect(history.value[0]?.value).toBe('abc')
  })

  it('moves repeated visits to the top and increments hits', () => {
    recordVisit('a', 'block')
    recordVisit('b', 'tx')
    recordVisit('a', 'block')
    const { history } = useSearchHistory()
    expect(history.value.map((e) => e.value)).toEqual(['a', 'b'])
    expect(history.value[0]?.hits).toBe(2)
  })

  it('treats same value with different kind as separate entries', () => {
    recordVisit('xyz', 'block')
    recordVisit('xyz', 'tx')
    const { history } = useSearchHistory()
    expect(history.value).toHaveLength(2)
  })

  it('caps to MAX_ENTRIES (20)', () => {
    for (let i = 0; i < 25; i++) {
      recordVisit(`block-${i}`, 'block')
    }
    const { history } = useSearchHistory()
    expect(history.value).toHaveLength(20)
    // Самый свежий первым.
    expect(history.value[0]?.value).toBe('block-24')
  })

  it('removeEntry removes by value+kind', () => {
    recordVisit('a', 'block')
    recordVisit('a', 'tx')
    removeEntry('a', 'block')
    const { history } = useSearchHistory()
    expect(history.value).toHaveLength(1)
    expect(history.value[0]?.kind).toBe('tx')
  })

  it('filterByPrefix returns matching prefix or substring', () => {
    recordVisit('abcdef', 'tx')
    recordVisit('zzz', 'tx')
    recordVisit('xabcyy', 'tx')
    const { filterByPrefix } = useSearchHistory()
    const all = filterByPrefix('')
    expect(all.length).toBe(3)
    const matches = filterByPrefix('abc')
    expect(matches.map((e) => e.value)).toEqual(expect.arrayContaining(['abcdef', 'xabcyy']))
    expect(matches.find((e) => e.value === 'zzz')).toBeUndefined()
  })

  it('clearHistory empties the list', () => {
    recordVisit('a', 'block')
    recordVisit('b', 'tx')
    clearHistory()
    const { history } = useSearchHistory()
    expect(history.value).toEqual([])
  })
})
