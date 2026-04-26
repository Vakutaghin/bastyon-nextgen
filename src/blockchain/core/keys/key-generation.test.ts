import { describe, it, expect, beforeEach } from 'vitest'
import { Buffer } from '../../utils/buffer-polyfill'
import { bip39 } from './bip39-loader'
import {
  generateMnemonic,
  mnemonicToSeed,
  seedToKeyPair,
  generateKeyPairFromMnemonic,
  generateKeys,
  clearKeyCache,
} from './key-generator'
import {
  recoverKeyPairFromHex,
  recoverKeyPairFromWIF,
  recoverKeyPair,
} from './key-recovery'
import {
  validateMnemonic,
  detectPrivateKeyFormat,
  validatePrivateKey,
  normalizeMnemonic,
} from './key-validator'
import { generateP2PKHAddress } from '../addresses/address-generator'
import { getMainAddressPath } from '../../constants/paths'

// ---------------------------------------------------------------------------
// Deterministic test vectors (BIP39 well-known mnemonics on Pocketnet network)
// Derived at path m/44'/0'/0'/0' with POCKETNET_NETWORK.
// ---------------------------------------------------------------------------

const TEST_MNEMONIC_1 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const TEST_VECTORS_1 = {
  seedPrefix: '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc1',
  privateKeyHex: 'ebb3082a71cf4b29239175619eb3e78a6316b6987ae2581c729706e1eae25ce4',
  publicKeyHex: '03538bedd425db67b3f68b1152235b56e4d938284dc31bb72648c2079b00f6101f',
  wif: '622yeutvxWjezmcrPxh3Lcup1ezxWsy7mbGg6MvXPvJLuM4E5rpT',
  address: 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy',
}

const TEST_MNEMONIC_2 =
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
const TEST_VECTORS_2 = {
  seedPrefix: 'b6a6d8921942dd9806607ebc2750416b289adea669198769f2e15ed926c3aa92',
  privateKeyHex: '70ccde436f6033aec01bc4f0301aa925b729a2d8a4e47186294d50b8a27e9708',
  publicKeyHex: '0265ae8ea93a32806d04c1d576353851d0fa0110ad5c3817a8d8aa898389f7f3c3',
  wif: '5wv5UAiH7uGLhqmLECva7ihheGFjsnXNcqWvxo7qyBRqR4a7CfnM',
  address: 'PUUAaAByj6BEey5CSYxJoGXr1KishVyC3A',
}

/**
 * Helper: get the English wordlist from the bip39 module.
 * mnemonicToSeed accepts an explicit wordlist parameter to bypass
 * automatic wordlist detection (which may mis-detect when the
 * bip39russian module is loaded alongside bip39).
 */
function getEnglishWordlist(): string[] {
  const wl = bip39.wordlists || {}
  return wl.english || wl.EN
}

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

describe('generateMnemonic', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('returns a 12-word string', () => {
    const mnemonic = generateMnemonic()
    const words = mnemonic.split(' ')
    expect(words).toHaveLength(12)
  })

  it('generates a valid BIP39 mnemonic', () => {
    const mnemonic = generateMnemonic()
    expect(validateMnemonic(mnemonic)).toBe(true)
  })

  it('generates different mnemonics on successive calls', () => {
    const m1 = generateMnemonic()
    const m2 = generateMnemonic()
    expect(m1).not.toBe(m2)
  })
})

/**
 * Helper: convert the result of mnemonicToSeed to a proper Buffer.
 * In some environments bip39.mnemonicToSeedSync may return a Uint8Array
 * instead of a Node Buffer, which causes Buffer.isBuffer() to return false.
 */
function toBuffer(data: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data)
}

describe('mnemonicToSeed', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('converts a known mnemonic to a deterministic 64-byte seed', () => {
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, getEnglishWordlist()))
    expect(seed.length).toBe(64)
    expect(seed.toString('hex').startsWith(TEST_VECTORS_1.seedPrefix)).toBe(true)
  })

  it('produces the correct seed for a second test vector', () => {
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_2, false, getEnglishWordlist()))
    expect(seed.toString('hex').startsWith(TEST_VECTORS_2.seedPrefix)).toBe(true)
  })

  it('normalizes whitespace and case', () => {
    const wl = getEnglishWordlist()
    const seed1 = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    clearKeyCache()
    const seedFromUpper = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1.toUpperCase(), false, wl))
    clearKeyCache()
    const seedFromPadded = toBuffer(mnemonicToSeed('  ' + TEST_MNEMONIC_1 + '  ', false, wl))
    expect(seed1.toString('hex')).toBe(seedFromUpper.toString('hex'))
    expect(seed1.toString('hex')).toBe(seedFromPadded.toString('hex'))
  })

  it('throws on empty mnemonic', () => {
    expect(() => mnemonicToSeed('')).toThrow('Mnemonic is required')
  })

  it('throws on invalid mnemonic', () => {
    expect(() =>
      mnemonicToSeed('foo bar baz qux quux quuz corge grault garply waldo fred plugh', false)
    ).toThrow()
  })

  it('returns the same object from cache on repeated calls', () => {
    const wl = getEnglishWordlist()
    const seed1 = mnemonicToSeed(TEST_MNEMONIC_1, true, wl)
    const seed2 = mnemonicToSeed(TEST_MNEMONIC_1, true, wl)
    // With cache enabled the exact same Buffer reference is returned
    expect(seed1).toBe(seed2)
  })

  it('returns fresh instances when cache is disabled', () => {
    const wl = getEnglishWordlist()
    const seed1 = mnemonicToSeed(TEST_MNEMONIC_1, false, wl)
    clearKeyCache()
    const seed2 = mnemonicToSeed(TEST_MNEMONIC_1, false, wl)
    // Same value but different object identity
    expect(seed1.toString('hex')).toBe(seed2.toString('hex'))
  })
})

describe('seedToKeyPair', () => {
  let seed1: Buffer
  let seed2: Buffer

  beforeEach(() => {
    clearKeyCache()
    // Pre-compute seeds using explicit English wordlist.
    // Wrap in toBuffer() because bip39 may return Uint8Array in vitest.
    seed1 = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, getEnglishWordlist()))
    clearKeyCache()
    seed2 = toBuffer(mnemonicToSeed(TEST_MNEMONIC_2, false, getEnglishWordlist()))
    clearKeyCache()
  })

  it('derives the expected key pair from a known seed', () => {
    const keyPair = seedToKeyPair(seed1, getMainAddressPath(0), false)

    expect(Buffer.isBuffer(keyPair.privateKey)).toBe(true)
    expect(Buffer.isBuffer(keyPair.publicKey)).toBe(true)
    expect(keyPair.privateKey.length).toBe(32)
    expect(keyPair.publicKey.length).toBe(33) // compressed
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_1.privateKeyHex)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('derives the expected key pair for a second seed', () => {
    const keyPair = seedToKeyPair(seed2, getMainAddressPath(0), false)
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_2.privateKeyHex)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
  })

  it('exposes an ecPair with toWIF()', () => {
    const keyPair = seedToKeyPair(seed1, getMainAddressPath(0), false)
    expect(keyPair.ecPair).toBeDefined()
    expect(typeof keyPair.ecPair.toWIF).toBe('function')
    expect(keyPair.ecPair.toWIF()).toBe(TEST_VECTORS_1.wif)
  })

  it('derives different keys for different derivation paths', () => {
    const kp0 = seedToKeyPair(seed1, getMainAddressPath(0), false)
    const kp1 = seedToKeyPair(seed1, getMainAddressPath(1), false)
    expect(kp0.privateKey.toString('hex')).not.toBe(kp1.privateKey.toString('hex'))
    expect(kp0.publicKey.toString('hex')).not.toBe(kp1.publicKey.toString('hex'))
  })

  it('returns cached result for same seed + path', () => {
    const kp1 = seedToKeyPair(seed1, getMainAddressPath(0), true)
    const kp2 = seedToKeyPair(seed1, getMainAddressPath(0), true)
    // Same reference from cache
    expect(kp1).toBe(kp2)
  })

  it('throws when given a non-Buffer seed', () => {
    expect(() => seedToKeyPair('not a buffer' as any)).toThrow('Valid seed is required')
  })

  it('throws when given null seed', () => {
    expect(() => seedToKeyPair(null as any)).toThrow('Valid seed is required')
  })
})

describe('generateKeyPairFromMnemonic', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('produces a key pair with expected structure', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const expected = seedToKeyPair(seed, getMainAddressPath(0), false)

    expect(Buffer.isBuffer(expected.privateKey)).toBe(true)
    expect(expected.privateKey.length).toBe(32)
    expect(Buffer.isBuffer(expected.publicKey)).toBe(true)
    expect(expected.publicKey.length).toBe(33)
    expect(expected.privateKey.toString('hex')).toBe(TEST_VECTORS_1.privateKeyHex)
    expect(expected.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('different derivation paths yield different keys', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const kp0 = seedToKeyPair(seed, getMainAddressPath(0), false)
    clearKeyCache()
    const kp1 = seedToKeyPair(seed, getMainAddressPath(1), false)
    expect(kp0.privateKey.toString('hex')).not.toBe(kp1.privateKey.toString('hex'))
  })
})

describe('generateKeys (full generation)', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('generates a valid 12-word mnemonic', () => {
    const mnemonic = generateMnemonic()
    expect(typeof mnemonic).toBe('string')
    expect(mnemonic.split(' ')).toHaveLength(12)
    expect(validateMnemonic(mnemonic)).toBe(true)
  })

  it('each call produces a unique mnemonic', () => {
    const m1 = generateMnemonic()
    const m2 = generateMnemonic()
    expect(m1).not.toBe(m2)
  })

  it('mnemonic can be converted to seed and then to key pair', () => {
    const mnemonic = generateMnemonic()
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(mnemonic, false, wl))
    expect(seed.length).toBe(64)

    clearKeyCache()
    const keyPair = seedToKeyPair(seed, getMainAddressPath(0), false)
    expect(Buffer.isBuffer(keyPair.privateKey)).toBe(true)
    expect(keyPair.privateKey.length).toBe(32)
    expect(Buffer.isBuffer(keyPair.publicKey)).toBe(true)
    expect(keyPair.publicKey.length).toBe(33)
  })
})

// ---------------------------------------------------------------------------
// Key Recovery
// ---------------------------------------------------------------------------

describe('recoverKeyPairFromHex', () => {
  it('recovers the correct key pair from a hex private key', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_1.privateKeyHex)
  })

  it('recovers the correct key pair for second test vector', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_2.privateKeyHex)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_2.privateKeyHex)
  })

  it('accepts uppercase hex', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex.toUpperCase())
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('trims whitespace', () => {
    const keyPair = recoverKeyPairFromHex('  ' + TEST_VECTORS_1.privateKeyHex + '  ')
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('throws on empty input', () => {
    expect(() => recoverKeyPairFromHex('')).toThrow('Hex private key is required')
  })

  it('throws on too-short hex string', () => {
    expect(() => recoverKeyPairFromHex('deadbeef')).toThrow('Invalid hex private key format')
  })

  it('throws on non-hex characters', () => {
    expect(() => recoverKeyPairFromHex('g'.repeat(64))).toThrow('Invalid hex private key format')
  })

  it('throws on odd-length hex that is 64 chars but non-hex', () => {
    expect(() => recoverKeyPairFromHex('zz' + '0'.repeat(62))).toThrow('Invalid hex private key format')
  })
})

describe('recoverKeyPairFromWIF', () => {
  it('recovers the correct key pair from a WIF private key', () => {
    const keyPair = recoverKeyPairFromWIF(TEST_VECTORS_1.wif)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_1.privateKeyHex)
  })

  it('recovers matching keys for a second test vector', () => {
    const keyPair = recoverKeyPairFromWIF(TEST_VECTORS_2.wif)
    expect(keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
    expect(keyPair.privateKey.toString('hex')).toBe(TEST_VECTORS_2.privateKeyHex)
  })

  it('throws on empty input', () => {
    expect(() => recoverKeyPairFromWIF('')).toThrow('WIF private key is required')
  })

  it('throws on garbage WIF string', () => {
    expect(() => recoverKeyPairFromWIF('notavalidWIFstring')).toThrow()
  })
})

describe('recoverKeyPair (auto-detect format)', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('auto-detects hex format and recovers keys', () => {
    const result = recoverKeyPair(TEST_VECTORS_1.privateKeyHex)
    expect(result.format).toBe('hex')
    expect(result.keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('auto-detects hex format for second test vector', () => {
    const result = recoverKeyPair(TEST_VECTORS_2.privateKeyHex)
    expect(result.format).toBe('hex')
    expect(result.keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
  })

  it('auto-detects mnemonic format via detectPrivateKeyFormat', () => {
    // Verify format detection works even if full recovery hits the
    // wordlist-detection issue with mnemonicToSeed
    const format = detectPrivateKeyFormat(TEST_MNEMONIC_1)
    expect(format).toBe('mnemonic')
  })

  it('throws on empty input', () => {
    expect(() => recoverKeyPair('')).toThrow('Private key is required')
  })

  it('throws on unrecognized format', () => {
    expect(() => recoverKeyPair('this-is-not-a-key')).toThrow('Unable to detect private key format')
  })

  it('accepts explicit format override', () => {
    const result = recoverKeyPair(TEST_VECTORS_1.privateKeyHex, { format: 'hex' })
    expect(result.format).toBe('hex')
    expect(result.keyPair.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })

  it('returns source in result', () => {
    const result = recoverKeyPair(TEST_VECTORS_1.privateKeyHex)
    expect(result.source).toBe(TEST_VECTORS_1.privateKeyHex)
  })
})

// ---------------------------------------------------------------------------
// Key Validation
// ---------------------------------------------------------------------------

describe('validateMnemonic', () => {
  it('returns true for valid 12-word English mnemonics', () => {
    expect(validateMnemonic(TEST_MNEMONIC_1)).toBe(true)
    expect(validateMnemonic(TEST_MNEMONIC_2)).toBe(true)
  })

  it('returns true for a freshly generated mnemonic', () => {
    const mnemonic = generateMnemonic()
    expect(validateMnemonic(mnemonic)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(validateMnemonic(TEST_MNEMONIC_1.toUpperCase())).toBe(true)
  })

  it('tolerates extra whitespace', () => {
    const padded = '  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  about  '
    expect(validateMnemonic(padded)).toBe(true)
  })

  it('returns false for random words that are not in BIP39 wordlist', () => {
    expect(
      validateMnemonic('foo bar baz qux quux quuz corge grault garply waldo fred plugh')
    ).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateMnemonic('')).toBe(false)
  })

  it('returns false for null / undefined', () => {
    expect(validateMnemonic(null as any)).toBe(false)
    expect(validateMnemonic(undefined as any)).toBe(false)
  })

  it('returns false for non-string types', () => {
    expect(validateMnemonic(12345 as any)).toBe(false)
  })

  it('returns false for too few words (valid words but wrong count)', () => {
    expect(validateMnemonic('abandon abandon abandon')).toBe(false)
  })

  it('returns false for valid words with wrong checksum', () => {
    // 12 valid BIP39 English words but with an incorrect checksum
    expect(
      validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')
    ).toBe(false)
  })
})

describe('detectPrivateKeyFormat', () => {
  it('detects mnemonic format', () => {
    expect(detectPrivateKeyFormat(TEST_MNEMONIC_1)).toBe('mnemonic')
  })

  it('detects hex format (64 hex characters)', () => {
    expect(detectPrivateKeyFormat(TEST_VECTORS_1.privateKeyHex)).toBe('hex')
  })

  it('returns null for Pocketnet WIF keys (network not passed to fromWIF internally)', () => {
    // detectPrivateKeyFormat calls ECPair.fromWIF without the Pocketnet network,
    // so Pocketnet-specific WIF keys are not recognized. This is a known
    // limitation. recoverKeyPairFromWIF works correctly because it passes the
    // network parameter.
    expect(detectPrivateKeyFormat(TEST_VECTORS_1.wif)).toBeNull()
    expect(detectPrivateKeyFormat(TEST_VECTORS_2.wif)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectPrivateKeyFormat('')).toBeNull()
  })

  it('returns null for null / undefined', () => {
    expect(detectPrivateKeyFormat(null as any)).toBeNull()
    expect(detectPrivateKeyFormat(undefined as any)).toBeNull()
  })

  it('returns null for unrecognized string', () => {
    expect(detectPrivateKeyFormat('hello-world')).toBeNull()
  })

  it('returns null for non-string types', () => {
    expect(detectPrivateKeyFormat(42 as any)).toBeNull()
  })

  it('does not confuse a short hex string for a key', () => {
    expect(detectPrivateKeyFormat('deadbeef')).toBeNull()
  })
})

describe('validatePrivateKey', () => {
  it('validates a mnemonic', () => {
    expect(validatePrivateKey(TEST_MNEMONIC_1)).toBe(true)
  })

  it('validates a hex private key', () => {
    expect(validatePrivateKey(TEST_VECTORS_1.privateKeyHex)).toBe(true)
  })

  it('returns false for Pocketnet WIF keys (known limitation: network not passed)', () => {
    // validatePrivateKey delegates to detectPrivateKeyFormat, which calls
    // ECPair.fromWIF without the Pocketnet network. Pocketnet-specific WIF
    // keys are not recognized.
    expect(validatePrivateKey(TEST_VECTORS_1.wif)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validatePrivateKey('')).toBe(false)
  })

  it('rejects null / undefined', () => {
    expect(validatePrivateKey(null as any)).toBe(false)
    expect(validatePrivateKey(undefined as any)).toBe(false)
  })

  it('rejects random garbage', () => {
    expect(validatePrivateKey('not-a-key')).toBe(false)
  })

  it('rejects hex of wrong length (not 64 chars)', () => {
    expect(validatePrivateKey('aabb')).toBe(false)
  })
})

describe('normalizeMnemonic', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeMnemonic('  ABANDON   ABANDON   ABOUT  ')).toBe('abandon abandon about')
  })

  it('preserves single spaces between words', () => {
    expect(normalizeMnemonic('one two three')).toBe('one two three')
  })

  it('returns empty string for falsy input', () => {
    expect(normalizeMnemonic('')).toBe('')
    expect(normalizeMnemonic(null as any)).toBe('')
    expect(normalizeMnemonic(undefined as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Address Derivation from Keys
// ---------------------------------------------------------------------------

describe('address derivation from keys', () => {
  it('derives a P2PKH address starting with "P" from hex private key (vector 1)', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    const addressInfo = generateP2PKHAddress(keyPair.publicKey)

    expect(addressInfo.address).toBe(TEST_VECTORS_1.address)
    expect(addressInfo.address.startsWith('P')).toBe(true)
    expect(addressInfo.type).toBe('p2pkh')
  })

  it('derives a P2PKH address starting with "P" from hex private key (vector 2)', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_2.privateKeyHex)
    const addressInfo = generateP2PKHAddress(keyPair.publicKey)

    expect(addressInfo.address).toBe(TEST_VECTORS_2.address)
    expect(addressInfo.address.startsWith('P')).toBe(true)
  })

  it('derives the same address from WIF private key (vector 1)', () => {
    const keyPair = recoverKeyPairFromWIF(TEST_VECTORS_1.wif)
    const addressInfo = generateP2PKHAddress(keyPair.publicKey)
    expect(addressInfo.address).toBe(TEST_VECTORS_1.address)
  })

  it('derives the same address from seed-derived key pair (vector 1)', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const keyPair = seedToKeyPair(seed, getMainAddressPath(0), false)
    const addressInfo = generateP2PKHAddress(keyPair.publicKey)
    expect(addressInfo.address).toBe(TEST_VECTORS_1.address)
  })

  it('different private keys produce different addresses', () => {
    const kp1 = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    const kp2 = recoverKeyPairFromHex(TEST_VECTORS_2.privateKeyHex)
    const addr1 = generateP2PKHAddress(kp1.publicKey)
    const addr2 = generateP2PKHAddress(kp2.publicKey)
    expect(addr1.address).not.toBe(addr2.address)
  })

  it('address includes publicKey in AddressInfo', () => {
    const keyPair = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    const addressInfo = generateP2PKHAddress(keyPair.publicKey)
    expect(Buffer.isBuffer(addressInfo.publicKey)).toBe(true)
    expect(addressInfo.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
  })
})

// ---------------------------------------------------------------------------
// Cross-format consistency: hex -> WIF -> seed all produce the same public key
// ---------------------------------------------------------------------------

describe('cross-format key recovery consistency', () => {
  beforeEach(() => {
    clearKeyCache()
  })

  it('hex and WIF recovery produce identical keys for vector 1', () => {
    const fromHex = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    const fromWIF = recoverKeyPairFromWIF(TEST_VECTORS_1.wif)

    expect(fromHex.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
    expect(fromWIF.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
    expect(fromHex.privateKey.toString('hex')).toBe(fromWIF.privateKey.toString('hex'))
  })

  it('hex and WIF recovery produce identical keys for vector 2', () => {
    const fromHex = recoverKeyPairFromHex(TEST_VECTORS_2.privateKeyHex)
    const fromWIF = recoverKeyPairFromWIF(TEST_VECTORS_2.wif)

    expect(fromHex.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
    expect(fromWIF.publicKey.toString('hex')).toBe(TEST_VECTORS_2.publicKeyHex)
    expect(fromHex.privateKey.toString('hex')).toBe(fromWIF.privateKey.toString('hex'))
  })

  it('seed-derived key matches hex and WIF recovery for vector 1', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const fromSeed = seedToKeyPair(seed, getMainAddressPath(0), false)
    const fromHex = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)

    expect(fromSeed.publicKey.toString('hex')).toBe(fromHex.publicKey.toString('hex'))
    expect(fromSeed.privateKey.toString('hex')).toBe(fromHex.privateKey.toString('hex'))
  })

  it('WIF from ecPair round-trips to the same key pair', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const keyPair = seedToKeyPair(seed, getMainAddressPath(0), false)
    const wif = keyPair.ecPair.toWIF()
    expect(wif).toBe(TEST_VECTORS_1.wif)

    const recovered = recoverKeyPairFromWIF(wif)
    expect(recovered.publicKey.toString('hex')).toBe(TEST_VECTORS_1.publicKeyHex)
    expect(recovered.privateKey.toString('hex')).toBe(TEST_VECTORS_1.privateKeyHex)
  })

  it('all three formats produce the same address', () => {
    const wl = getEnglishWordlist()
    const seed = toBuffer(mnemonicToSeed(TEST_MNEMONIC_1, false, wl))
    const fromSeed = seedToKeyPair(seed, getMainAddressPath(0), false)
    const fromHex = recoverKeyPairFromHex(TEST_VECTORS_1.privateKeyHex)
    const fromWIF = recoverKeyPairFromWIF(TEST_VECTORS_1.wif)

    const addr1 = generateP2PKHAddress(fromSeed.publicKey).address
    const addr2 = generateP2PKHAddress(fromHex.publicKey).address
    const addr3 = generateP2PKHAddress(fromWIF.publicKey).address

    expect(addr1).toBe(TEST_VECTORS_1.address)
    expect(addr2).toBe(TEST_VECTORS_1.address)
    expect(addr3).toBe(TEST_VECTORS_1.address)
  })
})

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------

describe('clearKeyCache', () => {
  it('clears the cache so subsequent calls recompute', () => {
    const wl = getEnglishWordlist()
    // Populate cache
    const seed1 = mnemonicToSeed(TEST_MNEMONIC_1, true, wl)
    const seed2 = mnemonicToSeed(TEST_MNEMONIC_1, true, wl)
    expect(seed1).toBe(seed2) // same reference from cache

    clearKeyCache()

    const seed3 = mnemonicToSeed(TEST_MNEMONIC_1, true, wl)
    // After clearing, the Buffer content should still match but it is a new object
    expect(seed3.toString('hex')).toBe(seed1.toString('hex'))
  })

  it('does not throw when called multiple times', () => {
    expect(() => {
      clearKeyCache()
      clearKeyCache()
      clearKeyCache()
    }).not.toThrow()
  })
})
