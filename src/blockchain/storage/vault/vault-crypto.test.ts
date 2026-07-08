import { describe, it, expect } from 'vitest'
import {
  bytesToB64,
  b64ToBytes,
  generateSecret,
  generateDeviceKey,
  derivePassphraseKey,
  wrapSecret,
  unwrapSecret,
  randomBytes,
  isSubtleAvailable,
  SECRET_BYTES,
  SALT_BYTES,
} from './vault-crypto'

// Быстрый KDF для тестов — реальные 600k не нужны для проверки round-trip.
const TEST_ITERS = 1000

describe('vault-crypto', () => {
  it('subtle доступен в тест-окружении (happy-dom)', () => {
    expect(isSubtleAvailable()).toBe(true)
  })

  it('base64 round-trip побайтово', () => {
    const bytes = randomBytes(40)
    expect(Array.from(b64ToBytes(bytesToB64(bytes)))).toEqual(Array.from(bytes))
  })

  it('generateSecret даёт 32 случайных байта, разные вызовы различны', () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a.length).toBe(SECRET_BYTES)
    expect(bytesToB64(a)).not.toBe(bytesToB64(b))
  })

  it('device-ключ: wrap → unwrap возвращает исходный секрет', async () => {
    const key = await generateDeviceKey()
    const secret = generateSecret()
    const env = await wrapSecret(key, secret)
    const back = await unwrapSecret(key, env)
    expect(Array.from(back)).toEqual(Array.from(secret))
  })

  it('device-ключ non-extractable: exportKey отвергается', async () => {
    const key = await generateDeviceKey()
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toBeTruthy()
  })

  it('каждый wrap использует свежий IV (два конверта одного секрета различны)', async () => {
    const key = await generateDeviceKey()
    const secret = generateSecret()
    const e1 = await wrapSecret(key, secret)
    const e2 = await wrapSecret(key, secret)
    expect(e1.iv).not.toBe(e2.iv)
    expect(e1.ct).not.toBe(e2.ct)
    // но оба разворачиваются в один секрет
    expect(bytesToB64(await unwrapSecret(key, e1))).toBe(bytesToB64(await unwrapSecret(key, e2)))
  })

  it('чужой device-ключ не разворачивает (AES-GCM auth)', async () => {
    const k1 = await generateDeviceKey()
    const k2 = await generateDeviceKey()
    const env = await wrapSecret(k1, generateSecret())
    await expect(unwrapSecret(k2, env)).rejects.toBeTruthy()
  })

  it('passphrase-ключ: тот же passphrase+salt разворачивает, другой — нет', async () => {
    const secret = generateSecret()
    const salt = randomBytes(SALT_BYTES)
    const kGood = await derivePassphraseKey('correct horse battery', salt, TEST_ITERS)
    const env = await wrapSecret(kGood, secret)

    const kSame = await derivePassphraseKey('correct horse battery', salt, TEST_ITERS)
    expect(bytesToB64(await unwrapSecret(kSame, env))).toBe(bytesToB64(secret))

    const kWrong = await derivePassphraseKey('wrong passphrase', salt, TEST_ITERS)
    await expect(unwrapSecret(kWrong, env)).rejects.toBeTruthy()
  })

  it('passphrase-ключ: тот же пароль, другой salt → не разворачивает', async () => {
    const secret = generateSecret()
    const k1 = await derivePassphraseKey('pw', randomBytes(SALT_BYTES), TEST_ITERS)
    const env = await wrapSecret(k1, secret)
    const k2 = await derivePassphraseKey('pw', randomBytes(SALT_BYTES), TEST_ITERS)
    await expect(unwrapSecret(k2, env)).rejects.toBeTruthy()
  })
})
