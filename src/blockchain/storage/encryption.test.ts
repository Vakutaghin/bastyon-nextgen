import { describe, it, expect } from 'vitest'
import CryptoJS from 'crypto-js'
import { encryptData, decryptData, canDecrypt } from './encryption'

describe('encryptData', () => {
  it('produces output with v2: prefix', () => {
    const result = encryptData('hello world', 'test-key')
    expect(result).toMatch(/^v2:/)
  })

  it('throws on empty data', () => {
    expect(() => encryptData('', 'key')).toThrow('Data is required')
  })

  it('throws on empty key', () => {
    expect(() => encryptData('data', '')).toThrow('Encryption key is required')
  })
})

describe('decryptData', () => {
  it('can decrypt v2-encrypted data', () => {
    const encrypted = encryptData('secret message', 'my-key')
    const decrypted = decryptData(encrypted, 'my-key')
    expect(decrypted).toBe('secret message')
  })

  it('throws on empty encrypted data', () => {
    expect(() => decryptData('', 'key')).toThrow('Encrypted data is required')
  })

  it('throws on empty key', () => {
    expect(() => decryptData('v2:abc', '')).toThrow('Decryption key is required')
  })

  it('throws on wrong key', () => {
    const encrypted = encryptData('secret', 'correct-key')
    expect(() => decryptData(encrypted, 'wrong-key')).toThrow()
  })
})

describe('encrypt-then-decrypt roundtrip', () => {
  it('roundtrips short string', () => {
    const plaintext = 'hello'
    const key = 'roundtrip-key'
    expect(decryptData(encryptData(plaintext, key), key)).toBe(plaintext)
  })

  it('roundtrips JSON data', () => {
    const data = JSON.stringify({ address: 'abc123', keys: [1, 2, 3] })
    const key = 'json-key'
    expect(decryptData(encryptData(data, key), key)).toBe(data)
  })

  it('roundtrips unicode content', () => {
    const text = 'Привет мир! 🌍'
    const key = 'unicode-key'
    expect(decryptData(encryptData(text, key), key)).toBe(text)
  })
})

describe('randomness / IV uniqueness', () => {
  it('different keys produce different ciphertext', () => {
    const data = 'same plaintext'
    const enc1 = encryptData(data, 'key-A')
    const enc2 = encryptData(data, 'key-B')
    expect(enc1).not.toBe(enc2)
  })

  it('same plaintext with same key produces DIFFERENT ciphertext (random IV)', () => {
    const data = 'repeated plaintext'
    const key = 'same-key'
    const enc1 = encryptData(data, key)
    const enc2 = encryptData(data, key)
    expect(enc1).not.toBe(enc2)
    // But both should decrypt to the same value
    expect(decryptData(enc1, key)).toBe(data)
    expect(decryptData(enc2, key)).toBe(data)
  })
})

describe('canDecrypt', () => {
  it('returns true for correct key', () => {
    const encrypted = encryptData('test data', 'my-key')
    expect(canDecrypt(encrypted, 'my-key')).toBe(true)
  })

  it('returns false for wrong key', () => {
    const encrypted = encryptData('test data', 'correct-key')
    expect(canDecrypt(encrypted, 'wrong-key')).toBe(false)
  })
})

describe('legacy backward compatibility', () => {
  it('decrypts legacy data (without v2: prefix) using CryptoJS passphrase mode', () => {
    const plaintext = 'legacy secret data'
    const key = 'legacy-key'
    // Create legacy-format encrypted data using CryptoJS passphrase-based encryption
    const legacyEncrypted = CryptoJS.AES.encrypt(plaintext, key).toString()
    // Ensure it does NOT have v2: prefix
    expect(legacyEncrypted.startsWith('v2:')).toBe(false)
    // decryptData should still handle it
    const decrypted = decryptData(legacyEncrypted, key)
    expect(decrypted).toBe(plaintext)
  })
})
