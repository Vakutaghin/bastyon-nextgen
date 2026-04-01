import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import {
  bufferToHex,
  hexToBuffer,
  stringToBase64,
  base64ToString,
  bufferToBase64,
  base64ToBuffer,
  hexToBase64,
  base64ToHex,
  normalizeHex,
  isValidHex,
} from './format-converters'

describe('bufferToHex', () => {
  it('converts buffer to hex string', () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef])
    expect(bufferToHex(buf)).toBe('deadbeef')
  })

  it('throws for non-buffer', () => {
    expect(() => bufferToHex('hello' as any)).toThrow('Buffer is required')
  })
})

describe('hexToBuffer', () => {
  it('converts hex to buffer', () => {
    const buf = hexToBuffer('deadbeef')
    expect(buf).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
  })

  it('handles uppercase hex', () => {
    const buf = hexToBuffer('DEADBEEF')
    expect(buf).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
  })

  it('throws for empty string', () => {
    expect(() => hexToBuffer('')).toThrow('Hex string is required')
  })

  it('throws for invalid hex', () => {
    expect(() => hexToBuffer('xyz')).toThrow('Invalid hex format')
  })
})

describe('stringToBase64 / base64ToString', () => {
  it('round-trips ASCII string', () => {
    const str = 'hello world'
    expect(base64ToString(stringToBase64(str))).toBe(str)
  })

  it('round-trips Unicode string', () => {
    const str = 'Привет мир 🌍'
    expect(base64ToString(stringToBase64(str))).toBe(str)
  })

  it('throws for non-string input', () => {
    expect(() => stringToBase64(123 as any)).toThrow('String is required')
    expect(() => base64ToString(123 as any)).toThrow('Base64 string is required')
  })
})

describe('bufferToBase64 / base64ToBuffer', () => {
  it('round-trips buffer', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const result = base64ToBuffer(bufferToBase64(buf))
    expect(result).toEqual(buf)
  })

  it('throws for non-buffer', () => {
    expect(() => bufferToBase64('hello' as any)).toThrow('Buffer is required')
  })
})

describe('hexToBase64 / base64ToHex', () => {
  it('round-trips hex string', () => {
    const hex = 'deadbeef'
    expect(base64ToHex(hexToBase64(hex))).toBe(hex)
  })
})

describe('normalizeHex', () => {
  it('lowercases and trims', () => {
    expect(normalizeHex('  DEADBEEF  ')).toBe('deadbeef')
  })

  it('removes whitespace', () => {
    expect(normalizeHex('de ad be ef')).toBe('deadbeef')
  })

  it('returns empty for null/undefined', () => {
    expect(normalizeHex(null as any)).toBe('')
    expect(normalizeHex(undefined as any)).toBe('')
    expect(normalizeHex('')).toBe('')
  })
})

describe('isValidHex', () => {
  it('returns true for valid hex', () => {
    expect(isValidHex('deadbeef')).toBe(true)
    expect(isValidHex('0123456789abcdef')).toBe(true)
  })

  it('returns true for uppercase hex', () => {
    expect(isValidHex('DEADBEEF')).toBe(true)
  })

  it('returns false for invalid hex', () => {
    expect(isValidHex('xyz')).toBe(false)
    expect(isValidHex('ghij')).toBe(false)
  })

  it('returns false for empty/null', () => {
    expect(isValidHex('')).toBe(false)
    expect(isValidHex(null as any)).toBe(false)
  })
})
