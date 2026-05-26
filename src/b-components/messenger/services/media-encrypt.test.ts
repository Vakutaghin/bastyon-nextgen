import { describe, it, expect } from 'vitest'

import { encryptBlobWithRandomKey } from './media-encrypt'
import { decryptBytesWithSecret, sniffMimeFromBytes, MediaDecryptError } from './media-decrypt'

const sampleBytes = (length: number, seed = 0): Uint8Array => {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) out[i] = (i * 7 + seed) & 0xff
  return out
}

describe('media-encrypt + media-decrypt', () => {
  it('round-trips a blob via AES-CBC with the random key as secret', async () => {
    const original = sampleBytes(64, 1)
    const blob = new Blob([original], { type: 'application/octet-stream' })

    const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(blob)

    expect(typeof secretStr).toBe('string')
    expect(secretStr).toHaveLength(64) // 32 random bytes -> 64 hex chars
    expect(encryptedBlob.size).toBeGreaterThan(0)
    // AES-CBC PKCS7 always grows by 1..16 bytes
    expect(encryptedBlob.size).toBeGreaterThanOrEqual(original.length)

    const decrypted = await decryptBytesWithSecret(await encryptedBlob.arrayBuffer(), secretStr)
    expect(decrypted).toEqual(original)
  })

  it('produces different ciphertexts for the same plaintext (random key)', async () => {
    const original = sampleBytes(48, 2)
    const blob = new Blob([original], { type: 'application/octet-stream' })

    const a = await encryptBlobWithRandomKey(blob)
    const b = await encryptBlobWithRandomKey(blob)

    expect(a.secretStr).not.toEqual(b.secretStr)
    const ciphertextA = new Uint8Array(await a.encryptedBlob.arrayBuffer())
    const ciphertextB = new Uint8Array(await b.encryptedBlob.arrayBuffer())
    expect(ciphertextA).not.toEqual(ciphertextB)
  })

  it('decrypt throws MediaDecryptError on misaligned ciphertext', async () => {
    const badData = new Uint8Array(33).buffer // not multiple of 16
    await expect(decryptBytesWithSecret(badData, 'a'.repeat(64))).rejects.toBeInstanceOf(
      MediaDecryptError
    )
  })

  it('decrypt throws MediaDecryptError on empty secret', async () => {
    const validSize = new Uint8Array(32).buffer
    await expect(decryptBytesWithSecret(validSize, '')).rejects.toBeInstanceOf(MediaDecryptError)
  })

  it('sniffs common MIME types from magic bytes', () => {
    expect(sniffMimeFromBytes(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe('audio/mpeg') // ID3
    expect(sniffMimeFromBytes(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toBe('audio/mpeg') // MP3 sync
    expect(sniffMimeFromBytes(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe('audio/ogg')
    expect(sniffMimeFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png')
    expect(sniffMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffMimeFromBytes(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm')
    expect(
      sniffMimeFromBytes(
        new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])
      )
    ).toBe('video/mp4')
    expect(sniffMimeFromBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBeNull()
  })
})
