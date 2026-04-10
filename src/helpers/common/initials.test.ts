import { describe, it, expect } from 'vitest'
import { getInitials } from './initials'

describe('getInitials', () => {
  it('returns fallback for undefined/null/empty', () => {
    expect(getInitials(undefined)).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials('')).toBe('?')
    expect(getInitials('   ')).toBe('?')
  })

  it('returns custom fallback', () => {
    expect(getInitials(undefined, { fallback: '' })).toBe('')
    expect(getInitials(null, { fallback: 'X' })).toBe('X')
  })

  it('returns single initial for one word', () => {
    expect(getInitials('Иван')).toBe('И')
    expect(getInitials('alice')).toBe('A')
  })

  it('returns two initials for two words', () => {
    expect(getInitials('Иван Петров')).toBe('ИП')
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns at most maxLetters initials', () => {
    expect(getInitials('Иван Петрович Сидоров', { maxLetters: 1 })).toBe('И')
    expect(getInitials('Иван Петрович Сидоров', { maxLetters: 3 })).toBe('ИПС')
    expect(getInitials('Иван Петрович Сидоров')).toBe('ИП') // default 2
  })

  it('handles extra whitespace', () => {
    expect(getInitials('  Иван   Петров  ')).toBe('ИП')
  })

  it('uppercases initials', () => {
    expect(getInitials('ivan petrov')).toBe('IP')
  })

  it('handles non-string input gracefully', () => {
    expect(getInitials(42 as any)).toBe('?')
    expect(getInitials({} as any)).toBe('?')
  })
})
