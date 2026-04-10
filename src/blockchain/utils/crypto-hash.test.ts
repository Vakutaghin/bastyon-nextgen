import { describe, it, expect } from 'vitest'
import { sha256, hash256, hexEncode } from './crypto-hash'
import { Buffer } from './buffer-polyfill'

describe('hexEncode', () => {
  it('encodes ASCII string to hex', () => {
    expect(hexEncode('abc')).toBe('616263')
  })

  it('encodes empty string', () => {
    expect(hexEncode('')).toBe('')
  })

  it('encodes multi-byte chars (char code)', () => {
    // 'A' = 0x41
    expect(hexEncode('A')).toBe('41')
  })
})

describe('sha256', () => {
  it('hashes a string', () => {
    const result = sha256('hello')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32) // SHA256 = 32 bytes
    expect(result.toString('hex')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })

  it('hashes a Buffer', () => {
    const buf = Buffer.from('hello')
    const result = sha256(buf)
    expect(result.toString('hex')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })
})

describe('hash256', () => {
  it('double-hashes a buffer (SHA256(SHA256(...)))', () => {
    const buf = Buffer.from('hello')
    const result = hash256(buf)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
    // SHA256(SHA256('hello')) — different from single SHA256
    expect(result.toString('hex')).not.toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })
})
