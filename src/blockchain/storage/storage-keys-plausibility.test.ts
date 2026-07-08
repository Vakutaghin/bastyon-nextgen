import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadEncryptedData } from './storage-keys'
import { memStorage } from './vault/test-mem-storage'

// Регресс на review-находку #2: неаутентифицированный AES-CBC ~1/256 «расшифровывает»
// fingerprint-данные под S в мусор БЕЗ броска. Heal-ветка обязана отсеять мусор по
// форме (looksLikeSecret) и уйти в legacy, а не вернуть мусор как секрет.
//
// Мок: под 'S' decrypt ВСЕГДА «успешен», но отдаёт неправдоподобный мусор; под 'fp'
// корректно расшифровывает реальные данные.
vi.mock('./encryption', () => ({
  encryptData: (d: string, k: string) => `${k}:${d}`,
  decryptData: (b: string, k: string) => {
    if (k === 'S') return 'garble-not-a-secret' // спурьёзная «расшифровка» под неверным ключом
    const idx = b.indexOf(':')
    if (b.slice(0, idx) !== k) throw new Error('wrong key')
    return b.slice(idx + 1)
  },
}))
vi.mock('./vault/crypto-vault', () => ({
  getVaultSecret: () => 'S',
  getVaultLegacyKey: () => 'fp',
}))

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('heal-ветка: плаузибилити отсекает спурьёзную S-расшифровку (P0-1 review #2)', () => {
  it('под S «расшифровалось» в мусор → уходим в legacy и отдаём настоящий секрет', () => {
    localStorage.setItem(
      'K',
      JSON.stringify({ data: `fp:${MNEMONIC}`, timestamp: 1, version: '2.0' })
    )

    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res.success).toBe(true)
    expect(res.data).toBe(MNEMONIC) // НЕ 'garble-not-a-secret'

    // и перешифровано под S
    const stored = JSON.parse(localStorage.getItem('K')!) as { data: string }
    expect(stored.data).toBe(`S:${MNEMONIC}`)
  })
})
