// Сервис шифрования/дешифрования сообщений и аудио мессенджера
// Инкапсулирует криптографические операции (AES-CBC, PBKDF2) без зависимости от стейта

import { AES_CBC_IV, PBKDF2_SALT, PBKDF2_ITERATIONS } from '../store/consts'
import { detectAudioMime, hexStringToUint8Array } from '../helpers'

/**
 * Деривирует AES-CBC ключ из строки-секрета через PBKDF2.
 * Общий метод для шифрования и дешифрования аудио.
 */
async function deriveAesCbcKey(secretStr: string): Promise<CryptoKey> {
  const enc = new TextEncoder()

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return window.crypto.subtle.deriveKey(
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
}

/**
 * Шифрует аудио-блоб с помощью AES-CBC.
 * Генерирует случайный секрет и возвращает зашифрованные данные вместе с секретом.
 *
 * @param blob - исходные аудиоданные
 * @returns зашифрованный блоб и строка-секрет для шифрования через pcrypto
 */
export async function encryptAudioBlob(
  blob: Blob
): Promise<{ encryptedBlob: Blob; secretStr: string }> {
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const secretStr = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const derivedKey = await deriveAesCbcKey(secretStr)

  const plainBuffer = await blob.arrayBuffer()
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    plainBuffer
  )

  const encryptedBlob = new Blob([cipherBuffer], { type: 'application/octet-stream' })

  return { encryptedBlob, secretStr }
}

/**
 * Дешифрует аудио-блоб с помощью AES-CBC.
 *
 * @param blob - зашифрованные аудиоданные
 * @param secretStr - строка-секрет (расшифрованная через pcrypto)
 * @returns расшифрованный блоб с корректным MIME или null при ошибке
 */
export async function decryptAudioBlob(blob: Blob, secretStr: string): Promise<Blob | null> {
  const arrayBuffer = await blob.arrayBuffer()

  // Проверка размера данных для AES-CBC
  if (arrayBuffer.byteLength < 16) {
    console.error(
      '[EncryptionService] Данные слишком малы для AES-CBC:',
      arrayBuffer.byteLength,
      'байт'
    )
    return null
  }
  if (arrayBuffer.byteLength % 16 !== 0) {
    console.error(
      '[EncryptionService] Невалидный размер для AES-CBC (не кратен 16):',
      arrayBuffer.byteLength,
      'байт'
    )
    return null
  }

  const derivedKey = await deriveAesCbcKey(secretStr)

  const decryptedResult = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    arrayBuffer
  )

  const decryptedBytes = new Uint8Array(decryptedResult)
  const mime = detectAudioMime(decryptedBytes)

  return new Blob([decryptedBytes as unknown as BlobPart], { type: mime || 'audio/mpeg' })
}

/**
 * Шифрует текст общим ключом группы (AES-CBC, hex).
 * Совместим с bastyon-chat: pcryptoFile.encrypt(utf8(text), commonKey) → hex.
 */
export async function encryptTextWithSecret(plaintext: string, secretStr: string): Promise<string> {
  const enc = new TextEncoder()
  const derivedKey = await deriveAesCbcKey(secretStr)
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    enc.encode(plaintext)
  )
  return Array.from(new Uint8Array(cipherBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Дешифрует hex-тело группового сообщения общим ключом (AES-CBC).
 * Совместим с bastyon-chat: pcryptoFile.decrypt(Buffer.from(body, 'hex'), commonKey) → utf8.
 */
export async function decryptTextWithSecret(hexCipher: string, secretStr: string): Promise<string> {
  const bytes = hexStringToUint8Array(hexCipher)
  const derivedKey = await deriveAesCbcKey(secretStr)
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    bytes as unknown as BufferSource
  )
  return new TextDecoder().decode(plainBuffer)
}

// ─── Волна голосового в зашифрованном чате ───────────────────────────────────
// Открыто сервер видит только то, что видел всегда (размер, длительность), —
// волна уходит под ключом самого голосового. Ключ — свой, выведенный из
// секрета файла (HKDF, AES-GCM со случайным IV): AES-CBC файла идёт с
// постоянным IV, и второй шифротекст под тем же ключом ему ни к чему.

const WAVEFORM_KEY_INFO = 'bastyon-voice-waveform-v1'
const GCM_IV_BYTES = 12

async function waveformKey(secretStr: string, usage: KeyUsage): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const material = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretStr),
    'HKDF',
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(WAVEFORM_KEY_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  )
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Волна (0…1) под ключом голосового: hex(IV ‖ шифротекст), по байту на число. */
export async function sealWaveform(samples: readonly number[], secretStr: string): Promise<string> {
  const max = Math.max(...samples, 0)
  const bytes = Uint8Array.from(samples, (v) => (max > 0 ? Math.round((v / max) * 255) : 0))
  const iv = window.crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES))
  const key = await waveformKey(secretStr, 'encrypt')
  const cipher = new Uint8Array(
    await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  )
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return toHex(out)
}

/** Открыть волну голосового; чужая, битая или не по ключу — null. */
export async function openWaveform(sealed: string, secretStr: string): Promise<number[] | null> {
  if (!/^[0-9a-f]+$/i.test(sealed) || sealed.length % 2 !== 0) return null
  const bytes = hexStringToUint8Array(sealed)
  if (bytes.length <= GCM_IV_BYTES + 16) return null
  try {
    const key = await waveformKey(secretStr, 'decrypt')
    const plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, GCM_IV_BYTES) as unknown as BufferSource },
      key,
      bytes.slice(GCM_IV_BYTES) as unknown as BufferSource
    )
    return Array.from(new Uint8Array(plain), (b) => b / 255)
  } catch {
    return null
  }
}
