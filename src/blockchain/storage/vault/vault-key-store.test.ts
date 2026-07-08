import { describe, it, expect } from 'vitest'
import { createMemoryVaultKeyStore } from './vault-key-store'
import {
  generateDeviceKey,
  generateSecret,
  wrapSecret,
  unwrapSecret,
  bytesToB64,
} from './vault-crypto'

// Реальный indexedDbVaultKeyStore проверяется отдельно с fake-indexeddb (см. Stage 6).
// Здесь — контракт in-memory бэкенда, который инъектируется в тестах crypto-vault.

describe('createMemoryVaultKeyStore', () => {
  it('get до set → null', async () => {
    const ks = createMemoryVaultKeyStore()
    expect(await ks.getKey()).toBeNull()
  })

  it('set → get возвращает тот же CryptoKey (годный для unwrap)', async () => {
    const ks = createMemoryVaultKeyStore()
    const key = await generateDeviceKey()
    await ks.setKey(key)
    const got = await ks.getKey()
    expect(got).not.toBeNull()

    // Ключ функционально тот же: конверт, сделанный на исходном, разворачивается полученным.
    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))
  })

  it('delete → get → null', async () => {
    const ks = createMemoryVaultKeyStore()
    await ks.setKey(await generateDeviceKey())
    await ks.deleteKey()
    expect(await ks.getKey()).toBeNull()
  })
})
