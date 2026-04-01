import { describe, it, expect } from 'vitest'
import {
  validateBip32Path,
  parseBip32Path,
  createBip32Path,
  getParentBip32Path,
  getLastIndexFromPath,
  isHardenedPath,
} from './bip32-paths'

describe('validateBip32Path', () => {
  it('validates standard BIP44 path', () => {
    expect(validateBip32Path("m/44'/0'/0'/0'")).toBe(true)
  })

  it('validates non-hardened path', () => {
    expect(validateBip32Path('m/44/0/0/0')).toBe(true)
  })

  it('validates mixed hardened/non-hardened', () => {
    expect(validateBip32Path("m/44'/0/0'/0")).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateBip32Path('')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(validateBip32Path(null as any)).toBe(false)
    expect(validateBip32Path(undefined as any)).toBe(false)
  })

  it('rejects path without m prefix', () => {
    expect(validateBip32Path("44'/0'/0'")).toBe(false)
  })

  it('rejects bare m', () => {
    expect(validateBip32Path('m')).toBe(false)
  })
})

describe('parseBip32Path', () => {
  it('parses standard path', () => {
    expect(parseBip32Path("m/44'/0'/0'/0'")).toEqual([44, 0, 0, 0])
  })

  it('parses non-hardened path', () => {
    expect(parseBip32Path('m/44/0/0')).toEqual([44, 0, 0])
  })

  it('throws on invalid path', () => {
    expect(() => parseBip32Path('invalid')).toThrow('Invalid BIP32 path format')
  })
})

describe('createBip32Path', () => {
  it('creates path from indices', () => {
    expect(createBip32Path([44, 0, 0, 0])).toBe('m/44/0/0/0')
  })

  it('creates hardened path', () => {
    expect(createBip32Path([44, 0, 0, 0], [true, true, true, true]))
      .toBe("m/44'/0'/0'/0'")
  })

  it('creates mixed path', () => {
    expect(createBip32Path([44, 0, 0], [true, false, true]))
      .toBe("m/44'/0/0'")
  })

  it('throws on empty indices', () => {
    expect(() => createBip32Path([])).toThrow('At least one index is required')
  })
})

describe('getParentBip32Path', () => {
  it('returns parent path', () => {
    expect(getParentBip32Path("m/44'/0'/0'/0'")).toBe("m/44'/0'/0'")
  })

  it('returns null for minimal path', () => {
    expect(getParentBip32Path("m/44'")).toBeNull()
  })

  it('throws on invalid path', () => {
    expect(() => getParentBip32Path('invalid')).toThrow()
  })
})

describe('getLastIndexFromPath', () => {
  it('returns last index', () => {
    expect(getLastIndexFromPath("m/44'/0'/0'/5'")).toBe(5)
  })

  it('returns last non-hardened index', () => {
    expect(getLastIndexFromPath('m/44/0/3')).toBe(3)
  })

  it('throws on invalid path', () => {
    expect(() => getLastIndexFromPath('invalid')).toThrow()
  })
})

describe('isHardenedPath', () => {
  it('returns true for hardened path', () => {
    expect(isHardenedPath("m/44'/0'/0'")).toBe(true)
  })

  it('returns false for non-hardened path', () => {
    expect(isHardenedPath('m/44/0/0')).toBe(false)
  })

  it('returns false for invalid path', () => {
    expect(isHardenedPath('invalid')).toBe(false)
  })
})
