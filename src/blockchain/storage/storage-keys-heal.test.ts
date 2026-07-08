import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadEncryptedData } from './storage-keys'
import { memStorage } from './vault/test-mem-storage'

// P0-1 heal-ветка: данные под legacy fingerprint читаются и лениво перешифровываются
// под секрет сейфа S. Здесь — key-checking шифр (в отличие от identity в storage-keys.test).
vi.mock('./encryption', () => ({
  encryptData: (d: string, k: string) => `${k}:${d}`,
  decryptData: (b: string, k: string) => {
    const idx = b.indexOf(':')
    const kk = b.slice(0, idx)
    if (kk !== k) throw new Error('wrong key')
    return b.slice(idx + 1)
  },
}))
vi.mock('./vault/crypto-vault', () => ({
  getVaultSecret: () => 'S',
  getVaultLegacyKey: () => legacy,
}))

let legacy: string | null = 'fp'
// Реалистичный секрет — heal-плаузибилити (looksLikeSecret) требует форму мнемоники/ключа.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

beforeEach(() => {
  legacy = 'fp'
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('loadEncryptedData heal-ветка (P0-1)', () => {
  it('данные под fingerprint читаются и перешифровываются под S', () => {
    localStorage.setItem(
      'K',
      JSON.stringify({ data: `fp:${MNEMONIC}`, timestamp: 1, version: '2.0' })
    )

    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res.success).toBe(true)
    expect(res.data).toBe(MNEMONIC)

    // Перешифровано под S (ленивая миграция на чтении).
    const stored = JSON.parse(localStorage.getItem('K')!) as { data: string }
    expect(stored.data).toBe(`S:${MNEMONIC}`)
  })

  it('данные уже под S — читаются напрямую, без heal-записи', () => {
    localStorage.setItem(
      'K',
      JSON.stringify({ data: `S:${MNEMONIC}`, timestamp: 1, version: '2.0' })
    )
    const before = localStorage.getItem('K')
    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res.data).toBe(MNEMONIC)
    expect(localStorage.getItem('K')).toBe(before) // не переписано
  })

  it('legacy=null (миграция завершена) + чужой ключ → провал чтения, не heal', () => {
    legacy = null
    localStorage.setItem(
      'K',
      JSON.stringify({ data: `fp:${MNEMONIC}`, timestamp: 1, version: '2.0' })
    )
    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res.success).toBe(false)
  })
})
