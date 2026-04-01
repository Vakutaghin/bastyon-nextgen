import { describe, it, expect } from 'vitest'
import { POCKETNET_NETWORK, isPocketnetNetwork } from './network'

describe('POCKETNET_NETWORK', () => {
  it('has correct pubKeyHash for P addresses', () => {
    expect(POCKETNET_NETWORK.pubKeyHash).toBe(0x37) // 55
  })

  it('has correct scriptHash for Z addresses', () => {
    expect(POCKETNET_NETWORK.scriptHash).toBe(0x50) // 80
  })

  it('has correct WIF prefix', () => {
    expect(POCKETNET_NETWORK.wif).toBe(0x21) // 33
  })

  it('has bech32 prefix', () => {
    expect(POCKETNET_NETWORK.bech32).toBe('bc')
  })

  it('has bip32 keys', () => {
    expect(POCKETNET_NETWORK.bip32.public).toBe(0x0488b21e)
    expect(POCKETNET_NETWORK.bip32.private).toBe(0x0488ade4)
  })
})

describe('isPocketnetNetwork', () => {
  it('returns true for Pocketnet network', () => {
    expect(isPocketnetNetwork(POCKETNET_NETWORK)).toBe(true)
  })

  it('returns false for undefined', () => {
    expect(isPocketnetNetwork(undefined)).toBe(false)
  })

  it('returns false for different network', () => {
    expect(isPocketnetNetwork({
      ...POCKETNET_NETWORK,
      pubKeyHash: 0x00,
    })).toBe(false)
  })
})
