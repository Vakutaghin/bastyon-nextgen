import { describe, it, expect } from 'vitest'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { looksLikeSecret, looksLikeAccountsList } from './plausibility'
import { POCKETNET_NETWORK } from '../../constants/network'

const ECPair = ECPairFactory(ecc)

describe('looksLikeSecret', () => {
  it('принимает WIF сети Pocketnet — сжатый и несжатый', () => {
    // Вход по WIF сохраняет сам WIF: heal-ветки не должны принимать его за мусор.
    for (let i = 0; i < 20; i++) {
      const compressed = ECPair.makeRandom({ network: POCKETNET_NETWORK }).toWIF()
      const uncompressed = ECPair.makeRandom({
        network: POCKETNET_NETWORK,
        compressed: false,
      }).toWIF()
      expect(looksLikeSecret(compressed)).toBe(true)
      expect(looksLikeSecret(uncompressed)).toBe(true)
    }
  })

  it('принимает hex-ключ и мнемонику', () => {
    expect(looksLikeSecret('ab'.repeat(32))).toBe(true)
    expect(looksLikeSecret('abandon '.repeat(11) + 'about')).toBe(true)
  })

  it('отвергает мусор после неудачной расшифровки', () => {
    expect(looksLikeSecret('')).toBe(false)
    expect(looksLikeSecret('\u0007\u0013garbage')).toBe(false)
    expect(looksLikeSecret('short words only')).toBe(false)
  })
})

describe('looksLikeAccountsList', () => {
  it('узнаёт список аккаунтов и отвергает остальное', () => {
    expect(looksLikeAccountsList('{"accounts":[],"currentAccount":null}')).toBe(true)
    expect(looksLikeAccountsList('{"accounts":[]}')).toBe(false)
    expect(looksLikeAccountsList('not json')).toBe(false)
  })
})
