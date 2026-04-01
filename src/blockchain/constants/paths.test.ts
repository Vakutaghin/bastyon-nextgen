import { describe, it, expect } from 'vitest'
import { getMainAddressPath, getCryptoKeyPath, MAIN_ADDRESS_PATH, CRYPTO_KEY_PATH } from './paths'

describe('path constants', () => {
  it('has correct main address base path', () => {
    expect(MAIN_ADDRESS_PATH).toBe("m/44'/0'/0'")
  })

  it('has correct crypto key base path', () => {
    expect(CRYPTO_KEY_PATH).toBe("m/33'/0'/0'")
  })
})

describe('getMainAddressPath', () => {
  it('returns default path for index 0', () => {
    expect(getMainAddressPath()).toBe("m/44'/0'/0'/0'")
  })

  it('returns path for specific index', () => {
    expect(getMainAddressPath(5)).toBe("m/44'/0'/0'/5'")
  })

  it('returns path for index 0 explicitly', () => {
    expect(getMainAddressPath(0)).toBe("m/44'/0'/0'/0'")
  })
})

describe('getCryptoKeyPath', () => {
  it('returns path for valid index', () => {
    expect(getCryptoKeyPath(1)).toBe("m/33'/0'/0'/1'")
    expect(getCryptoKeyPath(12)).toBe("m/33'/0'/0'/12'")
  })

  it('throws for index < 1', () => {
    expect(() => getCryptoKeyPath(0)).toThrow('Crypto key index must be between 1 and 12')
  })

  it('throws for index > 12', () => {
    expect(() => getCryptoKeyPath(13)).toThrow('Crypto key index must be between 1 and 12')
  })
})
