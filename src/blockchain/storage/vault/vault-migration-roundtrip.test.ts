import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { memStorage } from './test-mem-storage'

// БЕЗ мока — настоящий crypto-js (encryption.ts). Доказывает, что после миграции
// секрет читается штатным decryptData под ключом сейфа S, т.е. формат v2:
// совместим и legacy fingerprint-данные корректно переезжают. Один payload,
// чтобы уложиться в бюджет времени PBKDF2-100k.

import { migrateLegacyToVault } from './vault-migration'
import { encryptData, decryptData } from '../encryption'
import { MNEMONIC_STORAGE_KEY } from '../../constants/storage'

const FP = 'device-fingerprint-64hex-like-legacy-key'
const S = 'AAAA1111BBBB2222CCCC3333DDDD4444' // ключ сейфа (в реале base64(32B))
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('migrateLegacyToVault (real crypto-js round-trip)', () => {
  it('mnemonic зашифрованный под FP → после миграции читается под S', () => {
    const wrapped = JSON.stringify({
      data: encryptData(MNEMONIC, FP),
      timestamp: 1,
      version: '2.0',
    })
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped)

    const res = migrateLegacyToVault(S, FP)
    expect(res.allOk).toBe(true)
    expect(res.migratedCount).toBe(1)

    const stored = JSON.parse(localStorage.getItem(MNEMONIC_STORAGE_KEY)!) as { data: string }
    expect(decryptData(stored.data, S)).toBe(MNEMONIC)
    expect(() => decryptData(stored.data, FP)).toThrow() // больше не под fingerprint
  })
})
