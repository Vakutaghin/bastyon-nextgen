/**
 * Чистое AES-CBC дешифрование blob по строке-секрету (secretStr),
 * полученной из распакованного pcrypto.encryptKey-конверта.
 *
 * Симметричный сценарий к media-encrypt.encryptBlobWithRandomKey:
 *   PBKDF2(secretStr, salt='matrix.pocketnet', iter=10000) -> AES-CBC-256
 *   IV — фиксированный [19..34] (для совместимости с bastyon-chat).
 *
 * Распаковка secretStr из info.secrets через pcrypto находится в стор-методе
 * fetchAndDecryptMedia (там есть доступ к участникам комнаты и профилям).
 */

const PBKDF2_SALT = 'matrix.pocketnet'
const PBKDF2_ITERATIONS = 10000
const FIXED_IV = new Uint8Array([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])

export class MediaDecryptError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'MediaDecryptError'
  }
}

/**
 * Дешифрует ArrayBuffer/Blob AES-CBC с фиксированным IV по секрет-строке.
 * Возвращает чистые байты (без MIME-обёртки). Вызывающий решает, какой mime навесить.
 */
export const decryptBytesWithSecret = async (
  data: ArrayBuffer,
  secretStr: string
): Promise<Uint8Array> => {
  if (!secretStr) throw new MediaDecryptError('empty secret string')
  if (data.byteLength < 16)
    throw new MediaDecryptError(`data too small for AES-CBC: ${data.byteLength} bytes`)
  if (data.byteLength % 16 !== 0)
    throw new MediaDecryptError(`data size not aligned to 16 bytes: ${data.byteLength} bytes`)

  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: FIXED_IV },
    derivedKey,
    data
  )
  return new Uint8Array(decrypted)
}

/**
 * Sniff MIME-типа по магическим байтам (для аудио + базовые картинки/видео).
 * Возвращает null, если не распознано.
 */
export const sniffMimeFromBytes = (bytes: Uint8Array): string | null => {
  if (!bytes || bytes.length < 4) return null
  const b0 = bytes[0]!,
    b1 = bytes[1]!,
    b2 = bytes[2]!,
    b3 = bytes[3]!

  // === Audio ===
  if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return 'audio/mpeg' // ID3 (MP3)
  if (b0 === 0xff && (b1 & 0xe0) === 0xe0) return 'audio/mpeg' // MP3 frame sync
  if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) return 'audio/ogg' // OggS
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) return 'audio/wav' // RIFF (WAV)
  if (b0 === 0xff && (b1 & 0xf0) === 0xf0) return 'audio/aac' // ADTS AAC
  if (b0 === 0x66 && b1 === 0x4c && b2 === 0x61 && b3 === 0x43) return 'audio/flac' // fLaC

  // === Image ===
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return 'image/jpeg'
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return 'image/png'
  if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46) return 'image/gif'
  if (
    b0 === 0x52 &&
    b1 === 0x49 &&
    b2 === 0x46 &&
    b3 === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp'

  // === Video / Matroska / WebM ===
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) {
    // EBML — WebM (video) или WebM (audio). По данным извне.
    return 'video/webm'
  }
  // ISO BMFF (MP4): bytes 4..7 == 'ftyp'
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return 'video/mp4'
  }

  return null
}

/**
 * Matrix-native encrypted attachments (m.room.encrypted msgtype или info.file):
 * AES-CTR с JWK-ключом. Используется как fallback для не-наших клиентов.
 * info структура: { key: JWK, iv: base64url, hashes?, ... }
 */
const base64UrlToBytes = (b64u: string): Uint8Array => {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

export const decryptMatrixAttachment = async (
  ciphertext: ArrayBuffer,
  info: { key?: { k?: string }; iv?: string }
): Promise<ArrayBuffer> => {
  if (!info?.key?.k || !info.iv) {
    throw new MediaDecryptError('missing key or iv for Matrix attachment')
  }
  const keyBytes = base64UrlToBytes(info.key.k)
  const ivBytes = base64UrlToBytes(info.iv)

  const key = await window.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CTR' }, false, [
    'encrypt',
    'decrypt',
  ])

  return window.crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: ivBytes, length: 64 },
    key,
    ciphertext
  )
}
