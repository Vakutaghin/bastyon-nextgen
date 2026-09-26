// Формат приватного файла — как у Rust (aes-gcm): nonce(12) || шифртекст || тег(16).
// Шифруем стандартным AES-256-GCM из node:crypto, расшифровываем кодом браузера.

import { createCipheriv, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptSecretFile } from './ipfs-secret'
import { SecretError } from './ipfs-errors'

function concat(...parts: ArrayLike<number>[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function encrypt(plain: Uint8Array): { key: string; blob: Uint8Array<ArrayBuffer> } {
  const key = randomBytes(32)
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const blob = concat(nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag())
  return { key: key.toString('base64'), blob }
}

describe('decryptSecretFile', () => {
  it('расшифровывает то, что зашифровано AES-256-GCM в формате Rust', async () => {
    const plain = new TextEncoder().encode('secret report\n'.repeat(1000))
    const { key, blob } = encrypt(plain)
    expect(await decryptSecretFile(key, blob)).toEqual(plain)
  })

  it('пустой файл тоже', async () => {
    const { key, blob } = encrypt(new Uint8Array())
    expect(await decryptSecretFile(key, blob)).toEqual(new Uint8Array())
  })

  it('чужой ключ, подменённый байт, короткий блоб и мусор вместо ключа — отказ', async () => {
    const { key, blob } = encrypt(new TextEncoder().encode('hello'))
    const other = encrypt(new Uint8Array([1])).key
    await expect(decryptSecretFile(other, blob)).rejects.toBeInstanceOf(SecretError)

    const tampered = blob.slice()
    tampered[14] = (tampered[14] as number) ^ 1
    await expect(decryptSecretFile(key, tampered)).rejects.toBeInstanceOf(SecretError)

    await expect(decryptSecretFile(key, blob.slice(0, 20))).rejects.toBeInstanceOf(SecretError)
    await expect(decryptSecretFile('не base64', blob)).rejects.toBeInstanceOf(SecretError)
    await expect(decryptSecretFile(btoa('short'), blob)).rejects.toBeInstanceOf(SecretError)
  })
})
