import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { memStorage } from './test-mem-storage'

// Миграцию мокаем — её корректность проверяется в vault-migration.test.ts, а
// реальный crypto-js PBKDF2 медленный. Здесь тестируем стейт-машину сейфа.
const migrateLegacyToVault = vi.fn(() => ({ allOk: true, migratedCount: 1 }))
vi.mock('./vault-migration', () => ({
  migrateLegacyToVault: (...a: unknown[]) => migrateLegacyToVault(...a),
}))

import {
  configureVault,
  ensureVaultReady,
  ensureInitialized,
  getVaultSecret,
  getVaultLevel,
  getVaultStatus,
  isVaultUnlocked,
  hasVault,
  lockVault,
  destroyVault,
  finalizeMigration,
  enablePassphrase,
  disablePassphrase,
  submitPassphrase,
  VaultLockedError,
  __resetVaultForTests,
} from './crypto-vault'
import { createMemoryVaultKeyStore, type VaultKeyStore } from './vault-key-store'
import { generateDeviceKey } from './vault-crypto'
import {
  DEVICE_FINGERPRINT_KEY,
  MNEMONIC_STORAGE_KEY,
  VAULT_ENVELOPE_KEY,
  VAULT_MIGRATION_KEY,
} from '../../constants/storage'

let keyStore: VaultKeyStore

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
  // navigator.locks в тест-окружении не нужен (одиночный контекст) — отключаем,
  // чтобы withLock шёл прямым путём и не зависел от happy-dom реализации.
  vi.stubGlobal('navigator', { locks: undefined })
  migrateLegacyToVault.mockClear()
  migrateLegacyToVault.mockReturnValue({ allOk: true, migratedCount: 1 })
  __resetVaultForTests()
  keyStore = createMemoryVaultKeyStore()
  configureVault({ keyStore })
})
afterEach(() => vi.unstubAllGlobals())

describe('crypto-vault: fresh install', () => {
  it('ensureVaultReady на чистом сторе → empty, getVaultSecret бросает', async () => {
    const out = await ensureVaultReady()
    expect(out.status).toBe('empty')
    expect(() => getVaultSecret()).toThrow(VaultLockedError)
  })

  it('ensureInitialized минтит device-сейф, разлочивает, пишет конверт', async () => {
    const out = await ensureInitialized()
    expect(out.status).toBe('unlocked')
    expect(out.level).toBe('device')
    expect(isVaultUnlocked()).toBe(true)
    expect(hasVault()).toBe(true)
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeTruthy()
    // base64(32 байта) = 44 символа
    expect(getVaultSecret()).toHaveLength(44)
    expect(await keyStore.getKey()).not.toBeNull()
  })
})

describe('crypto-vault: lock / unlock round-trip', () => {
  it('lock + ensureVaultReady восстанавливает тот же секрет S', async () => {
    await ensureInitialized()
    const secretBefore = getVaultSecret()

    lockVault()
    expect(isVaultUnlocked()).toBe(false)
    expect(() => getVaultSecret()).toThrow()

    const out = await ensureVaultReady()
    expect(out.status).toBe('unlocked')
    expect(getVaultSecret()).toBe(secretBefore) // тот же S развёрнут из IDB-ключа
  })
})

describe('crypto-vault: passphrase mode', () => {
  it('enable → device-ключ удалён, boot требует passphrase, верный пароль даёт тот же S', async () => {
    await ensureInitialized()
    const secretBefore = getVaultSecret()

    await enablePassphrase('correct horse battery staple')
    expect(getVaultLevel()).toBe('passphrase')
    expect(await keyStore.getKey()).toBeNull() // device-ключ уничтожен

    lockVault()
    const out = await ensureVaultReady()
    expect(out.status).toBe('needs-passphrase')
    expect(isVaultUnlocked()).toBe(false)

    const bad = await submitPassphrase('wrong')
    expect(bad.ok).toBe(false)
    expect(bad.reason).toBe('bad-passphrase')
    expect(isVaultUnlocked()).toBe(false)

    const good = await submitPassphrase('correct horse battery staple')
    expect(good.ok).toBe(true)
    expect(getVaultSecret()).toBe(secretBefore) // payload'ы не перешифровывались — тот же S
  })

  it('disable возвращает device-режим с тем же S', async () => {
    await ensureInitialized()
    const secretBefore = getVaultSecret()
    await enablePassphrase('pw-123')

    await disablePassphrase('pw-123')
    expect(getVaultLevel()).toBe('device')
    expect(await keyStore.getKey()).not.toBeNull()
    expect(getVaultSecret()).toBe(secretBefore)

    lockVault()
    const out = await ensureVaultReady()
    expect(out.status).toBe('unlocked')
    expect(getVaultSecret()).toBe(secretBefore)
  })

  it('disable с неверным текущим паролем бросает', async () => {
    await ensureInitialized()
    await enablePassphrase('pw-123')
    await expect(disablePassphrase('nope')).rejects.toBeTruthy()
  })
})

describe('crypto-vault: bootstrap from legacy fingerprint', () => {
  it('есть fingerprint-payload без конверта → bootstrap, отложенная миграция удаляет fingerprint', async () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-abcdef')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:xxx', timestamp: 1, version: '2.0' })
    )

    const out = await ensureVaultReady()
    expect(out.status).toBe('unlocked')
    expect(out.level).toBe('device')
    // Миграция отложена: конверт есть, fingerprint пока на месте.
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeTruthy()
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe('legacy-fp-abcdef')

    finalizeMigration()
    expect(migrateLegacyToVault).toHaveBeenCalledWith(getVaultSecret(), 'legacy-fp-abcdef')
    // allOk=true → fingerprint удалён.
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBeNull()
  })

  it('finalizeMigration при allOk=false НЕ удаляет fingerprint (self-healing)', async () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-abcdef')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:xxx', timestamp: 1, version: '2.0' })
    )
    await ensureVaultReady()

    migrateLegacyToVault.mockReturnValue({ allOk: false, migratedCount: 0 })
    finalizeMigration()
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe('legacy-fp-abcdef')
  })
})

describe('crypto-vault: never-brick / degrade', () => {
  it('keyStore.setKey бросает → ensureInitialized деградирует на fingerprint, НЕ бросает', async () => {
    configureVault({
      keyStore: {
        getKey: async () => null,
        setKey: async () => {
          throw new Error('idb down')
        },
        deleteKey: async () => {},
      },
    })
    const out = await ensureInitialized()
    expect(out.status).toBe('degraded-fingerprint')
    // getVaultSecret отдаёт fingerprint (level 0), а не бросает — свежий сид не теряется.
    expect(() => getVaultSecret()).not.toThrow()
    expect(getVaultSecret().length).toBeGreaterThanOrEqual(8)
  })

  it('device-конверт есть, но keyStore.getKey бросает → storage-unavailable (non-destructive, не мемоизируется)', async () => {
    await ensureInitialized() // создаёт конверт + ключ в mem
    lockVault()
    configureVault({
      keyStore: {
        getKey: async () => {
          throw new Error('idb hang')
        },
        setKey: async () => {},
        deleteKey: async () => {},
      },
    })
    const out = await ensureVaultReady()
    expect(out.status).toBe('storage-unavailable')
    expect(() => getVaultSecret()).toThrow() // не деградирует к неверному ключу
    // не мемоизировано: следующий вызов пробует снова
    expect(getVaultStatus()).toBe('storage-unavailable')
  })

  it('device-конверт есть, ключ IDB отсутствует (вытеснен) → needs-reset', async () => {
    await ensureInitialized()
    lockVault()
    await keyStore.deleteKey() // симулируем ITP-вытеснение
    const out = await ensureVaultReady()
    expect(out.status).toBe('needs-reset')
  })
})

describe('crypto-vault: review fixes', () => {
  it('#1 orphan device-ключ на буте НЕ чистится без маркера enable (cross-tab race guard)', async () => {
    await ensureInitialized()
    await enablePassphrase('pw-123') // device-ключ удалён, режим passphrase
    // Симулируем device-ключ, созданный конкурентным disablePassphrase в другой табе.
    await keyStore.setKey(await generateDeviceKey())
    lockVault()

    const out = await ensureVaultReady()
    expect(out.status).toBe('needs-passphrase')
    // Без маркера 'enable' ключ НЕ трогаем — иначе затёрли бы чужой disable.
    expect(await keyStore.getKey()).not.toBeNull()
  })

  it('#1 orphan device-ключ чистится при маркере enable (крэш enablePassphrase)', async () => {
    await ensureInitialized()
    await enablePassphrase('pw-123')
    await keyStore.setKey(await generateDeviceKey())
    localStorage.setItem(VAULT_MIGRATION_KEY, JSON.stringify({ phase: 'enable' }))
    lockVault()

    await ensureVaultReady()
    expect(await keyStore.getKey()).toBeNull() // orphan снят
    expect(localStorage.getItem(VAULT_MIGRATION_KEY)).toBeNull() // маркер очищен
  })

  it('#3 enablePassphrase добивает legacy-миграцию и сносит fingerprint до перехода', async () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-xyz')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:x', timestamp: 1, version: '2.0' })
    )
    await ensureVaultReady() // bootstrap: device, migrated:false, fingerprint на месте
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe('legacy-fp-xyz')

    await enablePassphrase('pw-123')
    expect(migrateLegacyToVault).toHaveBeenCalled()
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBeNull() // fingerprint не осиротел
    expect(getVaultLevel()).toBe('passphrase')
  })

  it('#4 ensureInitialized деградирует (не реджектит) при броске в readEnvelope', async () => {
    const badLs = {
      getItem: () => {
        throw new Error('boom')
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      get length() {
        return 0
      },
    }
    vi.stubGlobal('localStorage', badLs)

    const out = await ensureInitialized()
    expect(out.status).toBe('degraded-fingerprint') // не бросил наружу register/signIn
  })
})

describe('crypto-vault: destroy', () => {
  it('destroyVault сносит конверт, IDB-ключ и лочит', async () => {
    await ensureInitialized()
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'fp')
    await destroyVault()
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeNull()
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBeNull()
    expect(await keyStore.getKey()).toBeNull()
    expect(isVaultUnlocked()).toBe(false)
  })
})
