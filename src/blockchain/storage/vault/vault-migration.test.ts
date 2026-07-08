import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Быстрый обратимый шифр вместо crypto-js (реальный PBKDF2-100k слишком медленный
// для матрицы кейсов). Проверяем ОРКЕСТРАЦИЮ миграции; round-trip с настоящим
// crypto-js — в vault-migration-roundtrip.test.ts.
vi.mock('../encryption', () => ({
  encryptData: (data: string, key: string) =>
    `ENC|${key}|${btoa(unescape(encodeURIComponent(data)))}`,
  decryptData: (blob: string, key: string) => {
    const parts = blob.split('|')
    if (parts[0] !== 'ENC' || parts[1] !== key) throw new Error('wrong key')
    return decodeURIComponent(escape(atob(parts[2] ?? '')))
  },
}))

import { migrateLegacyToVault } from './vault-migration'
import { encryptData, decryptData } from '../encryption'
import { MNEMONIC_STORAGE_KEY, ACCOUNT_STORAGE_PREFIX } from '../../constants/storage'
import { ACCOUNTS_LIST_KEY } from '../storage-constants'
import { memStorage } from './test-mem-storage'

const FP = 'FINGERPRINT'
const S = 'VAULT-SECRET'
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const HEXKEY = 'a'.repeat(64)
const LIST = JSON.stringify({
  accounts: [{ address: 'PXabc', name: 'x', lastUsed: 1 }],
  currentAccount: 'PXabc',
})

function wrapped(plain: string, key: string): string {
  return JSON.stringify({ data: encryptData(plain, key), timestamp: 1, version: '2.0' })
}
function readWrapped(raw: string | null): string | null {
  if (!raw) return null
  return (JSON.parse(raw) as { data: string }).data
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('migrateLegacyToVault', () => {
  it('перешифровывает mnemonic (wrapped), accounts-list (bare), account-ключи с FP на S', () => {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped(MNEMONIC, FP))
    localStorage.setItem(ACCOUNTS_LIST_KEY, encryptData(LIST, FP)) // bare
    localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}PXabc`, wrapped(MNEMONIC, FP))
    localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}PXdef`, wrapped(HEXKEY, FP)) // private-key аккаунт

    const res = migrateLegacyToVault(S, FP)
    expect(res.allOk).toBe(true)
    expect(res.migratedCount).toBe(4)

    // Читается под S…
    expect(decryptData(readWrapped(localStorage.getItem(MNEMONIC_STORAGE_KEY))!, S)).toBe(MNEMONIC)
    expect(decryptData(localStorage.getItem(ACCOUNTS_LIST_KEY)!, S)).toBe(LIST) // остался bare
    expect(
      decryptData(readWrapped(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}PXabc`))!, S)
    ).toBe(MNEMONIC)
    expect(
      decryptData(readWrapped(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}PXdef`))!, S)
    ).toBe(HEXKEY)
    // …и НЕ под FP
    expect(() =>
      decryptData(readWrapped(localStorage.getItem(MNEMONIC_STORAGE_KEY))!, FP)
    ).toThrow()
  })

  it('идемпотентна: повторный прогон — no-op (всё уже под S)', () => {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped(MNEMONIC, FP))
    migrateLegacyToVault(S, FP)
    const after1 = localStorage.getItem(MNEMONIC_STORAGE_KEY)
    const res2 = migrateLegacyToVault(S, FP)
    expect(res2.allOk).toBe(true)
    expect(res2.migratedCount).toBe(0)
    expect(localStorage.getItem(MNEMONIC_STORAGE_KEY)).toBe(after1)
  })

  it('fingerprint=null → нечего мигрировать', () => {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped(MNEMONIC, S))
    const res = migrateLegacyToVault(S, null)
    expect(res).toEqual({ allOk: true, migratedCount: 0 })
  })

  it('нечитаемый/чужой blob → allOk=false, payload не тронут (fingerprint сохранится у вызывающего)', () => {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped(MNEMONIC, FP))
    localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}PXbad`, wrapped('secret', 'OTHER-KEY')) // ни S, ни FP
    const res = migrateLegacyToVault(S, FP)
    expect(res.allOk).toBe(false)
    // Хороший payload всё равно мигрировал…
    expect(decryptData(readWrapped(localStorage.getItem(MNEMONIC_STORAGE_KEY))!, S)).toBe(MNEMONIC)
    // …а плохой остался как был.
    expect(() =>
      decryptData(readWrapped(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}PXbad`))!, S)
    ).toThrow()
    expect(() =>
      decryptData(readWrapped(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}PXbad`))!, FP)
    ).toThrow()
  })

  it('плаузибилити отвергает бессмысленную расшифровку (не мнемоника/ключ/список)', () => {
    // «Расшифровка» под FP даёт неправдоподобный текст → не считаем валидным → allOk=false.
    localStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped('not a real mnemonic phrase!!!', FP))
    const res = migrateLegacyToVault(S, FP)
    expect(res.allOk).toBe(false)
  })

  it('мигрирует legacy-мнемонику из sessionStorage', () => {
    sessionStorage.setItem(MNEMONIC_STORAGE_KEY, wrapped(MNEMONIC, FP))
    const res = migrateLegacyToVault(S, FP)
    expect(res.allOk).toBe(true)
    expect(decryptData(readWrapped(sessionStorage.getItem(MNEMONIC_STORAGE_KEY))!, S)).toBe(
      MNEMONIC
    )
  })

  it('пустое хранилище → allOk=true, ничего не мигрировано', () => {
    expect(migrateLegacyToVault(S, FP)).toEqual({ allOk: true, migratedCount: 0 })
  })
})
