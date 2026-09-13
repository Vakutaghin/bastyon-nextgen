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
  it('keyStore.createKey бросает → ensureInitialized деградирует на fingerprint, НЕ бросает', async () => {
    configureVault({
      keyStore: {
        getKey: async () => null,
        createKey: async () => {
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
        createKey: async () => generateDeviceKey(),
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
    await keyStore.createKey()
    lockVault()

    const out = await ensureVaultReady()
    expect(out.status).toBe('needs-passphrase')
    // Без маркера 'enable' ключ НЕ трогаем — иначе затёрли бы чужой disable.
    expect(await keyStore.getKey()).not.toBeNull()
  })

  it('#1 orphan device-ключ чистится при маркере enable (крэш enablePassphrase)', async () => {
    await ensureInitialized()
    await enablePassphrase('pw-123')
    await keyStore.createKey()
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

// ─── Остатки плана сейфа (AUDIT_LEFTOVERS VP-3/VP-4/VP-6/VP-9/VP-11, V12) ──────

describe('crypto-vault: вытесненный ключ при незавершённой миграции', () => {
  it('device-конверт migrated:false + fingerprint на месте → re-bootstrap, а не needs-reset', async () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-abcdef')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:xxx', timestamp: 1, version: '2.0' })
    )
    const first = await ensureVaultReady()
    expect(first.status).toBe('unlocked')
    const secretBefore = getVaultSecret()

    // Миграция не успела/упала (migrated:false), а IDB-ключ вытеснен до следующего запуска.
    lockVault()
    await keyStore.deleteKey()

    const out = await ensureVaultReady()
    expect(out.status).toBe('unlocked')
    expect(out.level).toBe('device')
    expect(getVaultSecret()).not.toBe(secretBefore) // новый S под новым ключом
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBe('legacy-fp-abcdef') // payload'ы читаемы через heal
    expect(await keyStore.getKey()).not.toBeNull()
  })

  it('device-конверт migrated:true (fingerprint уже удалён) + ключ вытеснен → needs-reset', async () => {
    await ensureInitialized() // свежий сейф: migrated:true, fingerprint нет
    lockVault()
    await keyStore.deleteKey()
    expect((await ensureVaultReady()).status).toBe('needs-reset')
  })
})

describe('crypto-vault: ensureInitialized поверх мёртвого сейфа (вход по 12 словам)', () => {
  it('needs-reset → сейф сносится и минтится заново, getVaultSecret работает', async () => {
    await ensureInitialized()
    lockVault()
    await keyStore.deleteKey()
    expect((await ensureVaultReady()).status).toBe('needs-reset')

    const out = await ensureInitialized()
    expect(out.status).toBe('unlocked')
    expect(() => getVaultSecret()).not.toThrow()
    expect(await keyStore.getKey()).not.toBeNull()
  })
})

describe('crypto-vault: mintDeviceVault round-trip verify + storage.persist', () => {
  it('ключ «не долежал» до стора → degraded-fingerprint, конверт не оставлен (V12)', async () => {
    // createKey «успешен», но getKey ничего не возвращает — как IDB, потерявшая запись.
    configureVault({
      keyStore: {
        getKey: async () => null,
        createKey: () => generateDeviceKey(),
        deleteKey: async () => {},
      },
    })
    const out = await ensureInitialized()
    expect(out.status).toBe('degraded-fingerprint')
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeNull()
    expect(() => getVaultSecret()).not.toThrow() // fingerprint-фоллбек, register не падает
  })

  it('navigator.storage.persist() вызывается при создании device-ключа (VP-3)', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', { locks: undefined, storage: { persist } })
    await ensureInitialized()
    expect(persist).toHaveBeenCalledTimes(1)
  })
})

describe('crypto-vault: self-tuning KDF (VP-6)', () => {
  it('конверт с iter ниже target после верного пароля перезаворачивается на target', async () => {
    await ensureInitialized()
    const secretBefore = getVaultSecret()
    await enablePassphrase('correct horse battery')
    // «Старый» конверт: подменяем iter/salt/ct на дериват с 1000 итераций.
    const env = JSON.parse(localStorage.getItem(VAULT_ENVELOPE_KEY)!)
    const { derivePassphraseKey, wrapSecret, b64ToBytes, randomBytes, bytesToB64 } =
      await import('./vault-crypto')
    const salt = randomBytes(16)
    const weakKey = await derivePassphraseKey('correct horse battery', salt, 1000, 'SHA-256')
    const wrap = await wrapSecret(weakKey, b64ToBytes(secretBefore))
    const weakEnv = { ...env, iter: 1000, salt: bytesToB64(salt), iv: wrap.iv, ct: wrap.ct }
    localStorage.setItem(VAULT_ENVELOPE_KEY, JSON.stringify(weakEnv))
    lockVault()

    expect((await ensureVaultReady()).status).toBe('needs-passphrase')
    expect((await submitPassphrase('correct horse battery')).ok).toBe(true)
    expect(getVaultSecret()).toBe(secretBefore)

    const tuned = JSON.parse(localStorage.getItem(VAULT_ENVELOPE_KEY)!)
    expect(tuned.iter).toBe(600_000)
    expect(tuned.salt).not.toBe(weakEnv.salt)
    // и новый конверт разворачивается тем же паролем
    lockVault()
    expect((await submitPassphrase('correct horse battery')).ok).toBe(true)
    expect(getVaultSecret()).toBe(secretBefore)
  })
})

describe('crypto-vault: enablePassphrase при незавершённой миграции (N5/VP-11)', () => {
  it('fingerprint остался после finalizeMigration (allOk=false) → VaultMigrationIncompleteError, режим не меняется', async () => {
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-abcdef')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:xxx', timestamp: 1, version: '2.0' })
    )
    await ensureVaultReady()
    migrateLegacyToVault.mockReturnValue({ allOk: false, migratedCount: 0 })

    const { VaultMigrationIncompleteError } = await import('./crypto-vault')
    await expect(enablePassphrase('correct horse battery')).rejects.toBeInstanceOf(
      VaultMigrationIncompleteError
    )
    expect(getVaultLevel()).toBe('device')
    expect(JSON.parse(localStorage.getItem(VAULT_ENVELOPE_KEY)!).mode).toBe('device')
    expect(localStorage.getItem(VAULT_MIGRATION_KEY)).toBeNull()
    expect(await keyStore.getKey()).not.toBeNull()
  })
})

describe('crypto-vault: never-brick (VP-9)', () => {
  it('нет crypto.subtle → degraded-fingerprint, ensureInitialized не бросает, секрет = fingerprint', async () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real), subtle: undefined })
    expect((await ensureVaultReady()).status).toBe('degraded-fingerprint')
    const out = await ensureInitialized()
    expect(out.status).toBe('degraded-fingerprint')
    expect(getVaultSecret()).toBe(localStorage.getItem(DEVICE_FINGERPRINT_KEY))
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeNull()
  })

  it('IndexedDB, которая никогда не отвечает → storage-unavailable по таймауту, ничего не стёрто', async () => {
    vi.useFakeTimers()
    try {
      await ensureInitialized() // конверт device записан memory-стором
      lockVault()
      // Реальный IDB-бэкенд поверх «зависшего» indexedDB: open() возвращает
      // запрос, у которого ни один обработчик не срабатывает.
      const { indexedDbVaultKeyStore } = await import('./vault-key-store')
      configureVault({ keyStore: indexedDbVaultKeyStore })
      vi.stubGlobal('indexedDB', { open: () => ({}) })

      const p = ensureVaultReady()
      await vi.advanceTimersByTimeAsync(2600)
      const out = await p
      expect(out.status).toBe('storage-unavailable')
      expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeTruthy()
      expect(getVaultStatus()).toBe('storage-unavailable')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('crypto-vault: две вкладки (VP-9)', () => {
  it('одновременный bootstrap из двух модулей под общим lock → один ключ, один конверт, один S', async () => {
    // Две «вкладки» = два независимых инстанса модуля с общими localStorage,
    // keyStore и сериализующим navigator.locks.
    let chain: Promise<unknown> = Promise.resolve()
    const locks = {
      request: (_name: string, fn: () => Promise<unknown>) => {
        const run = chain.then(fn, fn)
        chain = run.catch(() => {})
        return run
      },
    }
    vi.stubGlobal('navigator', { locks })
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'legacy-fp-abcdef')
    localStorage.setItem(
      MNEMONIC_STORAGE_KEY,
      JSON.stringify({ data: 'v2:xxx', timestamp: 1, version: '2.0' })
    )
    const shared = createMemoryVaultKeyStore()
    const createKey = vi.spyOn(shared, 'createKey')

    vi.resetModules()
    const tabA = await import('./crypto-vault')
    vi.resetModules()
    const tabB = await import('./crypto-vault')
    expect(tabA).not.toBe(tabB)
    tabA.configureVault({ keyStore: shared })
    tabB.configureVault({ keyStore: shared })

    const [a, b] = await Promise.all([tabA.ensureVaultReady(), tabB.ensureVaultReady()])
    expect(a.status).toBe('unlocked')
    expect(b.status).toBe('unlocked')
    expect(createKey).toHaveBeenCalledTimes(1)
    expect(tabA.getVaultSecret()).toBe(tabB.getVaultSecret())
  })
})
