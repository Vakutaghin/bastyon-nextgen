import { describe, it, expect, vi } from 'vitest'
import { createMemoryVaultKeyStore, createPlatformVaultKeyStore } from './vault-key-store'
import {
  createCapacitorVaultKeyStore,
  CAPACITOR_VAULT_KEY,
  type PreferencesLike,
} from './vault-key-store-capacitor'
import { generateSecret, wrapSecret, unwrapSecret, bytesToB64 } from './vault-crypto'

// Реальный indexedDbVaultKeyStore — vault-key-store-idb.test.ts (skip без indexedDB).
// Здесь — контракт in-memory бэкенда (инъектируется в тестах crypto-vault),
// Capacitor-бэкенда (VP-2) и выбора платформенного дефолта.

describe('createMemoryVaultKeyStore', () => {
  it('get до create → null', async () => {
    const ks = createMemoryVaultKeyStore()
    expect(await ks.getKey()).toBeNull()
  })

  it('create → get возвращает тот же CryptoKey (годный для unwrap)', async () => {
    const ks = createMemoryVaultKeyStore()
    const key = await ks.createKey()
    const got = await ks.getKey()
    expect(got).not.toBeNull()

    // Ключ функционально тот же: конверт, сделанный на исходном, разворачивается полученным.
    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))
  })

  it('delete → get → null', async () => {
    const ks = createMemoryVaultKeyStore()
    await ks.createKey()
    await ks.deleteKey()
    expect(await ks.getKey()).toBeNull()
  })
})

function fakePrefs(): PreferencesLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get({ key }) {
      return { value: store.get(key) ?? null }
    },
    async set({ key, value }) {
      store.set(key, value)
    },
    async remove({ key }) {
      store.delete(key)
    },
  }
}

describe('createCapacitorVaultKeyStore (VP-2)', () => {
  it('create кладёт 32 случайных байта в Preferences; get импортирует non-extractable ключ, годный для unwrap', async () => {
    const prefs = fakePrefs()
    const ks = createCapacitorVaultKeyStore(prefs)
    expect(await ks.getKey()).toBeNull()

    const key = await ks.createKey()
    const stored = prefs.store.get(CAPACITOR_VAULT_KEY)
    expect(stored).toBeTruthy()
    expect(atob(stored!).length).toBe(32)

    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    // «Перезапуск»: новый инстанс стора поверх тех же Preferences.
    const again = createCapacitorVaultKeyStore(prefs)
    const got = await again.getKey()
    expect(got).not.toBeNull()
    expect(got!.extractable).toBe(false)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))
    await expect(globalThis.crypto.subtle.exportKey('raw', got!)).rejects.toBeTruthy()
  })

  it('повторный create заменяет ключ; delete → null; повреждённое значение → null', async () => {
    const prefs = fakePrefs()
    const ks = createCapacitorVaultKeyStore(prefs)
    await ks.createKey()
    const first = prefs.store.get(CAPACITOR_VAULT_KEY)
    await ks.createKey()
    expect(prefs.store.get(CAPACITOR_VAULT_KEY)).not.toBe(first)

    await ks.deleteKey()
    expect(await ks.getKey()).toBeNull()

    prefs.store.set(CAPACITOR_VAULT_KEY, btoa('short'))
    expect(await ks.getKey()).toBeNull()
  })
})

describe('createPlatformVaultKeyStore', () => {
  it('вне Capacitor (vitest) — IndexedDB-бэкенд; без indexedDB операции реджектят, а не виснут', async () => {
    vi.stubGlobal('indexedDB', undefined)
    try {
      const ks = createPlatformVaultKeyStore()
      await expect(ks.getKey()).rejects.toThrow(/indexedDB unavailable/)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
