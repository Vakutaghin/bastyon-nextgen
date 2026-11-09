// Шифрование группового текста и голосовых: совместимость с прежним клиентом
// (PBKDF2 + AES-256-CBC с фиксированным IV, сверка через node:crypto), отказ на
// чужом ключе и битых данных, волна голосового — не открывается подделанной.

import { createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import {
  decryptAudioBlob,
  decryptTextWithSecret,
  encryptAudioBlob,
  encryptTextWithSecret,
  openWaveform,
  sealWaveform,
} from './encryption-service'

// Параметры протокола bastyon-chat (pcryptoFile) — заданы здесь независимо от
// констант модуля: тест должен поймать, если их поменяют.
const LEGACY_IV = Buffer.from([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])
const legacyKey = (secret: string) => pbkdf2Sync(secret, 'matrix.pocketnet', 10_000, 32, 'sha256')
const legacyEncrypt = (plain: Buffer, secret: string) => {
  const c = createCipheriv('aes-256-cbc', legacyKey(secret), LEGACY_IV)
  // Через массив байтов: Buffer.concat с буферами node:crypto не сводится по типам
  // (две версии @types/node в дереве).
  return Buffer.from([...c.update(plain), ...c.final()])
}
const legacyDecrypt = (cipher: Buffer, secret: string) => {
  const d = createDecipheriv('aes-256-cbc', legacyKey(secret), LEGACY_IV)
  return Buffer.from([...d.update(cipher), ...d.final()])
}

const SECRET = 'c0ffee'.repeat(10) + 'beef'
const OTHER_SECRET = 'deadbeef'.repeat(8)

const blobOf = (bytes: Uint8Array, type = '') => new Blob([bytes as unknown as BlobPart], { type })
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

describe('групповой текст общим ключом', () => {
  it('шифротекст читается прежним клиентом: hex(AES-CBC), по 16 байт, без открытого текста', async () => {
    const text = 'Привет, группа 👋 — встреча в 19:00'
    const hex = await encryptTextWithSecret(text, SECRET)

    expect(hex).toMatch(/^[0-9a-f]+$/)
    expect(hex.length % 32).toBe(0)
    expect(hex).not.toContain(Buffer.from('19:00', 'utf8').toString('hex'))
    expect(legacyDecrypt(Buffer.from(hex, 'hex'), SECRET).toString('utf8')).toBe(text)
  })

  it('сообщение прежнего клиента расшифровывается в тот же текст', async () => {
    const text = 'Сообщение из bastyon-chat'
    const hex = legacyEncrypt(Buffer.from(text, 'utf8'), SECRET).toString('hex')
    await expect(decryptTextWithSecret(hex, SECRET)).resolves.toBe(text)
  })

  it('туда и обратно, включая пустую строку', async () => {
    // Ровно 16 байт — целый блок паддинга сверху.
    for (const text of ['', 'a', 'abcdefghijklmnop', 'x'.repeat(1000)]) {
      const hex = await encryptTextWithSecret(text, SECRET)
      await expect(decryptTextWithSecret(hex, SECRET)).resolves.toBe(text)
    }
  })

  it('чужой ключ — отказ, а не мусорный текст', async () => {
    const hex = await encryptTextWithSecret('секрет группы', SECRET)
    await expect(decryptTextWithSecret(hex, OTHER_SECRET)).rejects.toThrow()
  })

  it('битое тело (не hex, обрезанный шифротекст) — отказ', async () => {
    const hex = await encryptTextWithSecret('секрет группы', SECRET)
    await expect(decryptTextWithSecret('zz', SECRET)).rejects.toThrow()
    await expect(decryptTextWithSecret(hex.slice(0, 20), SECRET)).rejects.toThrow()
  })
})

describe('голосовое: шифрование файла', () => {
  // Начало OGG-файла (магия «OggS») и немного данных.
  const OGG = Uint8Array.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, ...Array(90).fill(7)])

  it('файл уходит шифротекстом со случайным секретом, по секрету — те же байты и MIME', async () => {
    const { encryptedBlob, secretStr } = await encryptAudioBlob(blobOf(OGG, 'audio/ogg'))

    expect(secretStr).toMatch(/^[0-9a-f]{64}$/)
    expect(encryptedBlob.type).toBe('application/octet-stream')
    const cipher = await bytesOf(encryptedBlob)
    expect(cipher.length % 16).toBe(0)
    expect(Buffer.from(cipher).includes(Buffer.from('OggS'))).toBe(false)

    const plain = await decryptAudioBlob(encryptedBlob, secretStr)
    expect(plain?.type).toBe('audio/ogg')
    expect(await bytesOf(plain!)).toEqual(OGG)
  })

  it('прежний клиент расшифровывает файл тем же секретом', async () => {
    const { encryptedBlob, secretStr } = await encryptAudioBlob(blobOf(OGG))
    const plain = legacyDecrypt(Buffer.from(await bytesOf(encryptedBlob)), secretStr)
    expect(new Uint8Array(plain)).toEqual(OGG)
  })

  it('у каждого файла свой секрет: одинаковые записи дают разный шифротекст', async () => {
    const a = await encryptAudioBlob(blobOf(OGG))
    const b = await encryptAudioBlob(blobOf(OGG))
    expect(a.secretStr).not.toBe(b.secretStr)
    expect(await bytesOf(a.encryptedBlob)).not.toEqual(await bytesOf(b.encryptedBlob))
  })

  it('голосовое прежнего клиента неизвестного формата — отдаётся как audio/mpeg', async () => {
    const raw = Uint8Array.from(Array(40).fill(1))
    const cipher = legacyEncrypt(Buffer.from(raw), SECRET)
    const plain = await decryptAudioBlob(blobOf(new Uint8Array(cipher)), SECRET)
    expect(plain?.type).toBe('audio/mpeg')
    expect(await bytesOf(plain!)).toEqual(raw)
  })

  it('обрезанный файл (меньше блока или не кратен 16 байтам) — null', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(decryptAudioBlob(blobOf(new Uint8Array(8)), SECRET)).resolves.toBeNull()
    await expect(decryptAudioBlob(blobOf(new Uint8Array(33)), SECRET)).resolves.toBeNull()
    log.mockRestore()
  })

  it('чужой секрет — исходный звук не отдаётся', async () => {
    const { encryptedBlob } = await encryptAudioBlob(blobOf(OGG))
    const out = await decryptAudioBlob(encryptedBlob, OTHER_SECRET).catch(() => null)
    expect(out).toBeNull()
  })
})

describe('голосовое: зашифрованная волна', () => {
  it('громкость нормируется по самому громкому куску; тишина — нули', async () => {
    const sealed = await sealWaveform([2, 4, 1], SECRET)
    const opened = await openWaveform(sealed, SECRET)
    expect(opened!.map((v) => Math.round(v * 100) / 100)).toEqual([0.5, 1, 0.25])

    const silent = await openWaveform(await sealWaveform([0, 0, 0], SECRET), SECRET)
    expect(silent).toEqual([0, 0, 0])
  })

  it('подделанный или обрезанный шифротекст — null (AES-GCM проверяет целостность)', async () => {
    const sealed = await sealWaveform([0.1, 0.9, 0.5, 0.3], SECRET)
    const last = sealed.slice(-2) === '00' ? 'ff' : '00'
    await expect(openWaveform(sealed.slice(0, -2) + last, SECRET)).resolves.toBeNull()
    await expect(openWaveform(sealed.slice(0, 40), SECRET)).resolves.toBeNull()
    await expect(openWaveform(sealed.slice(0, -1), SECRET)).resolves.toBeNull()
  })

  it('в запечатанной волне не видно самих значений', async () => {
    const sealed = await sealWaveform([1, 1, 1, 1, 1, 1, 1, 1], SECRET)
    expect(sealed).not.toContain('ffffffffffffffff')
  })
})
