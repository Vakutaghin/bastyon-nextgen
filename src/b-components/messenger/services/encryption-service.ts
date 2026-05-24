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
    ['deriveBits', 'deriveKey'],
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
    ['encrypt', 'decrypt'],
  )
}

/**
 * Шифрует аудио-блоб с помощью AES-CBC.
 * Генерирует случайный секрет и возвращает зашифрованные данные вместе с секретом.
 *
 * @param blob - исходные аудиоданные
 * @returns зашифрованный блоб и строка-секрет для шифрования через pcrypto
 */
export async function encryptAudioBlob(blob: Blob): Promise<{ encryptedBlob: Blob; secretStr: string }> {
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const secretStr = Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('')

  const derivedKey = await deriveAesCbcKey(secretStr)

  const plainBuffer = await blob.arrayBuffer()
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    plainBuffer,
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
    console.error('[EncryptionService] Данные слишком малы для AES-CBC:', arrayBuffer.byteLength, 'байт')
    return null
  }
  if (arrayBuffer.byteLength % 16 !== 0) {
    console.error('[EncryptionService] Невалидный размер для AES-CBC (не кратен 16):', arrayBuffer.byteLength, 'байт')
    return null
  }

  const derivedKey = await deriveAesCbcKey(secretStr)

  const decryptedResult = await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: AES_CBC_IV },
    derivedKey,
    arrayBuffer,
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
    enc.encode(plaintext),
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
    bytes as unknown as BufferSource,
  )
  return new TextDecoder().decode(plainBuffer)
}
