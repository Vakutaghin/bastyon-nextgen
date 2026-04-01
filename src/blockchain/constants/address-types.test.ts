import { describe, it, expect } from 'vitest'
import {
  getAddressTypeByPrefix,
  isP2PKHAddress,
  isP2SHAddress,
  isP2WPKHAddress,
} from './address-types'

describe('getAddressTypeByPrefix', () => {
  it('detects P2PKH addresses (P prefix)', () => {
    expect(getAddressTypeByPrefix('PAddr123')).toBe('p2pkh')
  })

  it('detects P2PKH addresses (T prefix)', () => {
    expect(getAddressTypeByPrefix('TAddr123')).toBe('p2pkh')
  })

  it('detects P2SH addresses (3 prefix)', () => {
    expect(getAddressTypeByPrefix('3Addr123')).toBe('p2sh')
  })

  it('detects P2SH addresses (Z prefix)', () => {
    expect(getAddressTypeByPrefix('ZAddr123')).toBe('p2sh')
  })

  it('detects P2SH addresses (Y prefix)', () => {
    expect(getAddressTypeByPrefix('YAddr123')).toBe('p2sh')
  })

  it('detects P2WPKH addresses (bc1 prefix)', () => {
    expect(getAddressTypeByPrefix('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('p2wpkh')
  })

  it('returns null for unknown prefix', () => {
    expect(getAddressTypeByPrefix('1BTC...')).toBeNull()
  })

  it('returns null for empty/null', () => {
    expect(getAddressTypeByPrefix('')).toBeNull()
    expect(getAddressTypeByPrefix(null as any)).toBeNull()
  })

  it('trims whitespace', () => {
    expect(getAddressTypeByPrefix('  PAddr123  ')).toBe('p2pkh')
  })
})

describe('isP2PKHAddress', () => {
  it('returns true for P2PKH', () => {
    expect(isP2PKHAddress('PAddr123')).toBe(true)
  })

  it('returns false for P2SH', () => {
    expect(isP2PKHAddress('3Addr123')).toBe(false)
  })
})

describe('isP2SHAddress', () => {
  it('returns true for P2SH', () => {
    expect(isP2SHAddress('3Addr123')).toBe(true)
    expect(isP2SHAddress('ZAddr123')).toBe(true)
  })

  it('returns false for P2PKH', () => {
    expect(isP2SHAddress('PAddr123')).toBe(false)
  })
})

describe('isP2WPKHAddress', () => {
  it('returns true for P2WPKH', () => {
    expect(isP2WPKHAddress('bc1qtest')).toBe(true)
  })

  it('returns false for P2PKH', () => {
    expect(isP2WPKHAddress('PAddr123')).toBe(false)
  })
})
