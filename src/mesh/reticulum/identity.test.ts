import { describe, expect, it } from 'vitest'

import { toHex } from '../bytes'
import { deriveRnsIdentity } from './identity'

// Эталон посчитан независимо: HKDF из `cryptography` (Python). Эти 64 байта
// Python RNS 1.5.4 принимает как identity: хэш 0151a8e9…, адрес LXMF 41bb6034….
const KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const EXPECTED =
  '9a2c2d869aee8ed2fd877980617a5a028d09a55c762e93f49b030cfbe242d67c' +
  '8d3f41ca3cb59fb2ec7601471e34345193f6b0a04b76d8f936c1024e7f4a2de0'

describe('reticulum identity from the account key', () => {
  it('matches the reference HKDF output', async () => {
    expect(toHex(await deriveRnsIdentity(KEY))).toBe(EXPECTED)
  })

  it('is the same for the same key and different for another', async () => {
    const other = KEY.slice()
    other[0] = 99
    expect(toHex(await deriveRnsIdentity(KEY))).toBe(toHex(await deriveRnsIdentity(KEY)))
    expect(toHex(await deriveRnsIdentity(other))).not.toBe(EXPECTED)
  })

  it('refuses a key of the wrong size', async () => {
    await expect(deriveRnsIdentity(new Uint8Array(31))).rejects.toThrow(RangeError)
  })
})
