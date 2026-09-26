// Формат приватного файла — как у Rust (aes-gcm): nonce(12) || шифртекст || тег(16).
// Шифруем стандартным AES-256-GCM из node:crypto, расшифровываем кодом браузера.

import { createCipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decryptSecretFile, decryptSecretStream, isStreamFormat } from './ipfs-secret'
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

// ---------------------------------------------------------------------------
// v2: кусками. Фикстура собрана независимо (node:crypto, make-secret-v2.mjs),
// её же читает Rust (crypto.rs): ключ — байты 0..31, кусок 1000 байт.
// ---------------------------------------------------------------------------

const FIXTURE_KEY = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const fixture = new Uint8Array(
  readFileSync(resolve(process.cwd(), 'src-tauri/src/ipfs/testdata/secret-v2.bin'))
)
const pattern = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)

/** Шифртекст кусками произвольной длины — как их отдаёт IPFS. */
async function* pieces(bytes: Uint8Array, size: number): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size)
}

async function openStream(key: string, bytes: Uint8Array, size = 997): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  for await (const plain of decryptSecretStream(
    key,
    pieces(bytes, size),
    Number.MAX_SAFE_INTEGER
  )) {
    parts.push(plain)
  }
  return concat(...parts)
}

async function openStreamWithLimit(key: string, bytes: Uint8Array, limit: number): Promise<number> {
  let total = 0
  for await (const plain of decryptSecretStream(key, pieces(bytes, 500), limit))
    total += plain.length
  return total
}

/** Шифрование v2 как в Rust (encrypt_stream), но node:crypto — независимо. */
function sealV2(plain: Uint8Array, chunk: number): { key: string; sealed: Uint8Array } {
  const key = new Uint8Array(randomBytes(32))
  const prefix = new Uint8Array(randomBytes(7))
  const header = concat(new TextEncoder().encode('BSTN'), [2], [0, 0, 0, 0], prefix)
  new DataView(header.buffer).setUint32(5, chunk)
  const parts: ArrayLike<number>[] = [header]
  const count = Math.max(1, Math.ceil(plain.length / chunk))
  for (let i = 0; i < count; i++) {
    const nonce = concat(prefix, [0, 0, 0, 0], [i === count - 1 ? 1 : 0])
    new DataView(nonce.buffer).setUint32(7, i)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(header)
    parts.push(cipher.update(plain.subarray(i * chunk, (i + 1) * chunk)), cipher.final())
    parts.push(cipher.getAuthTag())
  }
  return { key: btoa(String.fromCharCode(...key)), sealed: concat(...parts) }
}

describe('decryptSecretStream (v2)', () => {
  it('фикстура Rust и node:crypto читается при любой нарезке шифртекста', async () => {
    expect(isStreamFormat(fixture)).toBe(true)
    for (const size of [1, 7, 16, 1000, 1016, 4096, fixture.length]) {
      expect(await openStream(FIXTURE_KEY, fixture, size), `куски по ${size}`).toEqual(
        pattern(2500)
      )
    }
  })

  it('настоящий размер куска (1 МиБ): несколько кусков, кратный и пустой файл', async () => {
    for (const n of [0, 1024 * 1024, 2 * 1024 * 1024 + 123]) {
      const { key, sealed } = sealV2(pattern(n), 1024 * 1024)
      expect(await openStream(key, sealed, 256 * 1024), `${n} байт`).toEqual(pattern(n))
    }
  })

  it('отрезанный хвост, переставленные куски и чужой ключ — ошибка', async () => {
    const sealedChunk = 1000 + 16
    const body = 16
    const cut = fixture.slice(0, body + 2 * sealedChunk)
    await expect(openStream(FIXTURE_KEY, cut)).rejects.toBeInstanceOf(SecretError)

    const swapped = new Uint8Array([
      ...fixture.subarray(0, body),
      ...fixture.subarray(body + sealedChunk, body + 2 * sealedChunk),
      ...fixture.subarray(body, body + sealedChunk),
      ...fixture.subarray(body + 2 * sealedChunk),
    ])
    await expect(openStream(FIXTURE_KEY, swapped)).rejects.toBeInstanceOf(SecretError)

    const { key: other } = sealV2(new Uint8Array(1), 1000)
    await expect(openStream(other, fixture)).rejects.toBeInstanceOf(SecretError)
    await expect(openStream(FIXTURE_KEY, fixture.slice(0, 10))).rejects.toBeInstanceOf(SecretError)
  })

  it('потолок размера: поток обрывается, а не копит гигабайты', async () => {
    // Читаем, пока не упрёмся в потолок.
    const run = () => openStreamWithLimit(FIXTURE_KEY, fixture, 1500)
    await expect(run()).rejects.toBeInstanceOf(SecretError)
  })

  it('формат v1 потоковым не считается', () => {
    const { blob } = encrypt(new TextEncoder().encode('old'))
    expect(isStreamFormat(blob)).toBe(false)
  })
})
