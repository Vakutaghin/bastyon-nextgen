import { describe, it, expect } from 'vitest'
import { POCKETNET_NETWORK } from './network'
import { bitcoin as vendoredNetwork } from '../lib/pocketnet/modules/networks.js'

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

  it('has bip32 keys of the legacy client network', () => {
    expect(POCKETNET_NETWORK.bip32.public).toBe(0x043587cf)
    expect(POCKETNET_NETWORK.bip32.private).toBe(0x04358394)
  })

  it('matches the vendored legacy network as a whole (S8)', () => {
    // The two copies of the network parameters had already drifted apart once.
    expect(POCKETNET_NETWORK).toEqual(vendoredNetwork)
  })
})
