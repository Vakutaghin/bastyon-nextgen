import { describe, it, expect } from 'vitest'
import { transliterate, validateNickname, normalizeNickname } from './transliterate'

describe('transliterate', () => {
  it('transliterates lowercase Russian', () => {
    expect(transliterate('привет')).toBe('privet')
  })

  it('transliterates uppercase Russian', () => {
    expect(transliterate('ПРИВЕТ')).toBe('PRIVET')
  })

  it('transliterates mixed case', () => {
    expect(transliterate('Привет Мир')).toBe('Privet Mir')
  })

  it('keeps Latin characters as-is', () => {
    expect(transliterate('hello')).toBe('hello')
  })

  it('keeps numbers and special chars', () => {
    expect(transliterate('user123_test')).toBe('user123_test')
  })

  it('handles special characters: ж, ч, ш, щ, ю, я', () => {
    // щ -> 'sch' (not 'shch'), per transliteration map
    expect(transliterate('жчшщюя')).toBe('zhchshschyuya')
  })

  it('maps characters not in the map as-is', () => {
    // Characters not in the Russian alphabet map are kept unchanged
    expect(transliterate('a!b')).toBe('a!b')
  })

  it('handles empty string', () => {
    expect(transliterate('')).toBe('')
  })
})

describe('validateNickname', () => {
  it('accepts valid nicknames', () => {
    expect(validateNickname('user123')).toBe(true)
    expect(validateNickname('User_Name')).toBe(true)
    expect(validateNickname('a')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateNickname('')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(validateNickname('user name')).toBe(false)
    expect(validateNickname('user@name')).toBe(false)
    expect(validateNickname('user-name')).toBe(false)
  })

  it('rejects Russian characters', () => {
    expect(validateNickname('пользователь')).toBe(false)
  })
})

describe('normalizeNickname', () => {
  it('transliterates and sanitizes', () => {
    expect(normalizeNickname('Привет Мир!')).toBe('PrivetMir')
  })

  it('keeps valid characters', () => {
    expect(normalizeNickname('user_123')).toBe('user_123')
  })

  it('removes dashes and spaces', () => {
    expect(normalizeNickname('my-nick name')).toBe('mynickname')
  })

  it('handles empty string', () => {
    expect(normalizeNickname('')).toBe('')
  })
})
