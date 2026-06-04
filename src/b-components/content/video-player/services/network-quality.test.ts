import { describe, it, expect } from 'vitest'
import { getNetworkMaxHeight } from './network-quality'

describe('getNetworkMaxHeight', () => {
  it('returns null when connection API is absent', () => {
    expect(getNetworkMaxHeight(undefined)).toBeNull()
    expect(getNetworkMaxHeight(null)).toBeNull()
  })

  it('caps to 480p when Save-Data is requested (regardless of effectiveType)', () => {
    expect(getNetworkMaxHeight({ saveData: true })).toBe(480)
    expect(getNetworkMaxHeight({ saveData: true, effectiveType: '4g' })).toBe(480)
  })

  it('caps to 240p on 2g / slow-2g', () => {
    expect(getNetworkMaxHeight({ effectiveType: 'slow-2g' })).toBe(240)
    expect(getNetworkMaxHeight({ effectiveType: '2g' })).toBe(240)
  })

  it('caps to 480p on 3g', () => {
    expect(getNetworkMaxHeight({ effectiveType: '3g' })).toBe(480)
  })

  it('does not cap on 4g or unknown effectiveType', () => {
    expect(getNetworkMaxHeight({ effectiveType: '4g' })).toBeNull()
    expect(getNetworkMaxHeight({ effectiveType: 'whatever' })).toBeNull()
    expect(getNetworkMaxHeight({})).toBeNull()
  })
})
