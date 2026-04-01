import { describe, it, expect } from 'vitest'
import {
  HEX_REGEX,
  HEX_64_REGEX,
  URL_REGEX,
  CAPTCHA_CODE_REGEX,
  WHITESPACE_NORMALIZE_REGEX,
  TAG_SANITIZE_REGEX,
  URL_ENCODED_REGEX,
} from './validation-regexes'

describe('HEX_REGEX', () => {
  it('matches valid hex', () => {
    expect(HEX_REGEX.test('0123456789abcdefABCDEF')).toBe(true)
  })

  it('rejects non-hex', () => {
    expect(HEX_REGEX.test('xyz')).toBe(false)
    expect(HEX_REGEX.test('')).toBe(false)
  })
})

describe('HEX_64_REGEX', () => {
  it('matches 64-char hex', () => {
    const hex64 = 'a'.repeat(64)
    expect(HEX_64_REGEX.test(hex64)).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(HEX_64_REGEX.test('a'.repeat(63))).toBe(false)
    expect(HEX_64_REGEX.test('a'.repeat(65))).toBe(false)
  })
})

describe('URL_REGEX', () => {
  it('matches http URLs', () => {
    const text = 'visit https://example.com now'
    const matches = text.match(URL_REGEX)
    expect(matches).toBeTruthy()
    expect(matches![0]).toBe('https://example.com')
  })

  it('matches bastyon protocol', () => {
    const text = 'see bastyon://profile/user1'
    const matches = text.match(URL_REGEX)
    expect(matches).toBeTruthy()
  })
})

describe('CAPTCHA_CODE_REGEX', () => {
  it('matches valid captcha codes', () => {
    expect(CAPTCHA_CODE_REGEX.test('abcd')).toBe(true)
    expect(CAPTCHA_CODE_REGEX.test('ABC123')).toBe(true)
  })

  it('rejects too short codes', () => {
    expect(CAPTCHA_CODE_REGEX.test('abc')).toBe(false)
  })

  it('rejects special chars', () => {
    expect(CAPTCHA_CODE_REGEX.test('ab!d')).toBe(false)
  })
})

describe('WHITESPACE_NORMALIZE_REGEX', () => {
  it('matches multiple spaces', () => {
    expect('hello   world'.replace(WHITESPACE_NORMALIZE_REGEX, ' ')).toBe('hello world')
  })

  it('matches tabs and newlines', () => {
    expect('a\t\nb'.replace(WHITESPACE_NORMALIZE_REGEX, ' ')).toBe('a b')
  })
})

describe('URL_ENCODED_REGEX', () => {
  it('matches URL-encoded sequences', () => {
    expect(URL_ENCODED_REGEX.test('%20')).toBe(true)
    expect(URL_ENCODED_REGEX.test('%2F')).toBe(true)
  })

  it('rejects non-encoded text', () => {
    expect(URL_ENCODED_REGEX.test('hello')).toBe(false)
  })
})

describe('TAG_SANITIZE_REGEX', () => {
  it('matches special characters for removal', () => {
    expect('hello!@#world'.replace(TAG_SANITIZE_REGEX, '')).toBe('helloworld')
  })

  it('keeps Unicode letters and numbers', () => {
    expect('привет_123'.replace(TAG_SANITIZE_REGEX, '')).toBe('привет_123')
  })
})
