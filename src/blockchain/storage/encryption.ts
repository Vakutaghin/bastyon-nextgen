/**
 * Шифрование и дешифрование данных
 */

import CryptoJS from 'crypto-js'
import type {
  EncryptedData,
  EncryptionOptions,
  DecryptionOptions,
} from '../types/storage'

/**
 * Шифрует данные с использованием AES
 * @param data - Данные для шифрования
 * @param key - Ключ шифрования (обычно device fingerprint)
 * @param options - Опции шифрования
 * @returns Зашифрованные данные в base64 формате
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

  const { algorithm = 'AES', mode = 'CBC' } = options

  try {
    let encrypted: string

    if (algorithm === 'AES') {
      if (mode === 'CBC') {
        // AES-CBC шифрование
        encrypted = CryptoJS.AES.encrypt(data, key).toString()
      } else if (mode === 'GCM') {
        // AES-GCM шифрование (если поддерживается)
        // CryptoJS не поддерживает GCM напрямую, используем CBC
        encrypted = CryptoJS.AES.encrypt(data, key).toString()
      } else {
        throw new Error(`Unsupported encryption mode: ${mode}`)
      }
    } else {
      throw new Error(`Unsupported encryption algorithm: ${algorithm}`)
    }

    return encrypted
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Дешифрует данные
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

  const { algorithm = 'AES', mode = 'CBC' } = options

  try {
    let decrypted: CryptoJS.lib.WordArray

    if (algorithm === 'AES') {
      if (mode === 'CBC' || mode === 'GCM') {
        // AES дешифрование
        decrypted = CryptoJS.AES.decrypt(encryptedData, key)
      } else {
        throw new Error(`Unsupported decryption mode: ${mode}`)
      }
    } else {
      throw new Error(`Unsupported decryption algorithm: ${algorithm}`)
    }

    // Конвертируем в строку
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8)

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
