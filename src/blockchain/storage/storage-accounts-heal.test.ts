import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadAccountsList } from './storage-accounts'
import { ACCOUNTS_LIST_KEY } from './storage-constants'
import { memStorage } from './vault/test-mem-storage'

// P0-1 heal-ветка для списка аккаунтов (bare-шифротекст).
vi.mock('./encryption', () => ({
  encryptData: (d: string, k: string) => `${k}:${d}`,
  decryptData: (b: string, k: string) => {
    const idx = b.indexOf(':')
    if (b.slice(0, idx) !== k) throw new Error('wrong key')
    return b.slice(idx + 1)
  },
}))
vi.mock('./vault/crypto-vault', () => ({
  getVaultSecret: () => 'S',
  getVaultLegacyKey: () => legacy,
}))

let legacy: string | null = 'fp'
const LIST = { accounts: [{ address: 'P1', name: 'P1' }], currentAccount: 'P1' }

beforeEach(() => {
  legacy = 'fp'
  vi.stubGlobal('localStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('loadAccountsList heal-ветка (P0-1)', () => {
  it('список под fingerprint читается и перешифровывается под S (bare)', () => {
    localStorage.setItem(ACCOUNTS_LIST_KEY, `fp:${JSON.stringify(LIST)}`)

    const res = loadAccountsList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual(LIST)

    // bare-перешифровка под S.
    expect(localStorage.getItem(ACCOUNTS_LIST_KEY)).toBe(`S:${JSON.stringify(LIST)}`)
  })
})
