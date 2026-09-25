import { describe, it, expect } from 'vitest'
import { getMainAddressPath, MAIN_ADDRESS_PATH } from './paths'

describe('path constants', () => {
  it('has correct main address base path', () => {
    expect(MAIN_ADDRESS_PATH).toBe("m/44'/0'/0'")
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
