import { describe, it, expect } from 'vitest'
import { indexedDbVaultKeyStore } from './vault-key-store'
import {
  generateDeviceKey,
  generateSecret,
  wrapSecret,
  unwrapSecret,
  bytesToB64,
} from './vault-crypto'

// Реальный IndexedDB-бэкенд. happy-dom НЕ даёт indexedDB (и fake-indexeddb не умеет
// structured-clone non-extractable CryptoKey), поэтому кейс пропускается здесь и
// активируется в браузерном/IDB-окружении. Контракт интерфейса в happy-dom
// покрыт createMemoryVaultKeyStore (vault-key-store.test.ts).
describe.skipIf(typeof indexedDB === 'undefined')('indexedDbVaultKeyStore (real IDB)', () => {
  it('setKey → getKey сохраняет функционально тот же non-extractable ключ; deleteKey → null', async () => {
    const key = await generateDeviceKey()
    await indexedDbVaultKeyStore.setKey(key)

    const got = await indexedDbVaultKeyStore.getKey()
    expect(got).not.toBeNull()

    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    expect(bytesToB64(await unwrapSecret(got!, env))).toBe(bytesToB64(secret))

    // non-extractable: сырые байты не выгружаются
    await expect(globalThis.crypto.subtle.exportKey('raw', got!)).rejects.toBeTruthy()

    await indexedDbVaultKeyStore.deleteKey()
    expect(await indexedDbVaultKeyStore.getKey()).toBeNull()
  })
})
