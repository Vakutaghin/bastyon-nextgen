/**
 * Шифрование и дешифрование данных
 *
 * Использует AES-256-CBC с PBKDF2 для деривации ключа и случайным IV.
 * Формат v2: "v2:" + Base64(salt[16] + iv[16] + ciphertext)
 * Обратная совместимость: данные без префикса "v2:" расшифровываются старым способом (EVP_BytesToKey).
 */

import CryptoJS from 'crypto-js'
import type {
  EncryptedData,
  EncryptionOptions,
  DecryptionOptions,
} from '../types/storage'

const V2_PREFIX = 'v2:'
const SALT_SIZE = 128 / 8   // 16 bytes
const IV_SIZE = 128 / 8     // 16 bytes (AES block size)
const KEY_SIZE = 256 / 8    // 32 bytes (AES-256)
const PBKDF2_ITERATIONS = 100_000

/**
 * Derives AES key from passphrase using PBKDF2
 */
function deriveKey(passphrase: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: KEY_SIZE / 4, // CryptoJS uses 32-bit words
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  })
}

/**
 * Шифрует данные с использованием AES-256-CBC + PBKDF2 + random IV
 * @param data - Данные для шифрования
 * @param key - Ключ шифрования (обычно device fingerprint)
 * @param options - Опции шифрования
 * @returns Зашифрованные данные в формате v2
 */
export function encryptData(
  data: string,
  key: string,
  options: EncryptionOptions = {}
): EncryptedData {
  if (!data) {
    throw new Error('Data is required for encryption')
  }

  if (!key) {
    throw new Error('Encryption key is required')
  }

  const { algorithm = 'AES' } = options

  if (algorithm !== 'AES') {
    throw new Error(`Unsupported encryption algorithm: ${algorithm}`)
  }

  try {
    const salt = CryptoJS.lib.WordArray.random(SALT_SIZE)
    const iv = CryptoJS.lib.WordArray.random(IV_SIZE)
    const derivedKey = deriveKey(key, salt)

    const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })

    // Pack: salt + iv + ciphertext
    const combined = salt
      .concat(iv)
      .concat(encrypted.ciphertext)

    return V2_PREFIX + CryptoJS.enc.Base64.stringify(combined)
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Дешифрует данные (поддерживает v2 и legacy формат)
 * @param encryptedData - Зашифрованные данные
 * @param key - Ключ дешифрования (должен совпадать с ключом шифрования)
 * @param options - Опции дешифрования
 * @returns Расшифрованные данные
 */
export function decryptData(
  encryptedData: EncryptedData,
  key: string,
  options: DecryptionOptions = {}
): string {
  if (!encryptedData) {
    throw new Error('Encrypted data is required for decryption')
  }

  if (!key) {
    throw new Error('Decryption key is required')
  }

  const { algorithm = 'AES' } = options

  if (algorithm !== 'AES') {
    throw new Error(`Unsupported decryption algorithm: ${algorithm}`)
  }

  try {
    let decryptedString: string

    if (encryptedData.startsWith(V2_PREFIX)) {
      // v2 format: PBKDF2 + explicit IV
      const raw = CryptoJS.enc.Base64.parse(encryptedData.slice(V2_PREFIX.length))
      const rawWords = raw.words
      const rawSigBytes = raw.sigBytes

      const salt = CryptoJS.lib.WordArray.create(rawWords.slice(0, SALT_SIZE / 4), SALT_SIZE)
      const iv = CryptoJS.lib.WordArray.create(rawWords.slice(SALT_SIZE / 4, (SALT_SIZE + IV_SIZE) / 4), IV_SIZE)
      const ciphertext = CryptoJS.lib.WordArray.create(
        rawWords.slice((SALT_SIZE + IV_SIZE) / 4),
        rawSigBytes - SALT_SIZE - IV_SIZE
      )

      const derivedKey = deriveKey(key, salt)

      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext })
      const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })

      decryptedString = decrypted.toString(CryptoJS.enc.Utf8)
    } else {
      // Legacy format: CryptoJS passphrase-based (EVP_BytesToKey)
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key)
      decryptedString = decrypted.toString(CryptoJS.enc.Utf8)
    }

    if (!decryptedString) {
      throw new Error('Decryption failed: invalid key or corrupted data')
    }

    return decryptedString
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Проверяет, можно ли расшифровать данные с указанным ключом
 * @param encryptedData - Зашифрованные данные
 * @param key - Ключ для проверки
 * @returns true если данные можно расшифровать, false иначе
 */
export function canDecrypt(encryptedData: EncryptedData, key: string): boolean {
  try {
    const decrypted = decryptData(encryptedData, key)
    return decrypted.length > 0
  } catch {
    return false
  }
}
