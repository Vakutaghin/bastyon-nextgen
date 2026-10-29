/**
 * Шифрование и дешифрование данных
 *
 * Использует AES-256-CBC с PBKDF2 для деривации ключа и случайным IV.
 * Формат v2: "v2:" + Base64(salt[16] + iv[16] + ciphertext)
 * Обратная совместимость: данные без префикса "v2:" расшифровываются старым способом (EVP_BytesToKey).
 */

import CryptoJS from 'crypto-js'
import type { EncryptedData, EncryptionOptions, DecryptionOptions } from '../types/storage'

const V2_PREFIX = 'v2:'
const SALT_SIZE = 128 / 8 // 16 bytes
const IV_SIZE = 128 / 8 // 16 bytes (AES block size)
const KEY_SIZE = 256 / 8 // 32 bytes (AES-256)
const PBKDF2_ITERATIONS = 100_000

// 100 000 итераций PBKDF2 на crypto-js — это секунды главного потока телефона
// на каждое чтение или запись. При запуске их набиралось с пяток, и приложение
// стояло, пока не посчитает. Ключ для пары «пароль + соль» всегда один и тот
// же, поэтому считаем его раз за запуск и держим в памяти (там уже лежит и сам
// пароль — секрет сейфа). Новые записи под тем же паролем берут соль, ключ
// которой уже посчитан: IV у каждой записи по-прежнему свой.
const MAX_CACHED_KEYS = 64
const derivedKeys = new Map<string, CryptoJS.lib.WordArray>()
const writeSalts = new Map<string, CryptoJS.lib.WordArray>()

function passphraseId(passphrase: string): string {
  return CryptoJS.SHA256(passphrase).toString(CryptoJS.enc.Hex)
}

function keyId(passphrase: string, salt: CryptoJS.lib.WordArray): string {
  return `${passphraseId(passphrase)}:${CryptoJS.enc.Hex.stringify(salt)}`
}

function rememberKey(
  passphrase: string,
  salt: CryptoJS.lib.WordArray,
  key: CryptoJS.lib.WordArray
): void {
  if (derivedKeys.size >= MAX_CACHED_KEYS) derivedKeys.clear()
  derivedKeys.set(keyId(passphrase, salt), key.clone())
  const pid = passphraseId(passphrase)
  if (!writeSalts.has(pid)) writeSalts.set(pid, salt.clone())
}

/**
 * Derives AES key from passphrase using PBKDF2
 */
function deriveKey(passphrase: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
  const cached = derivedKeys.get(keyId(passphrase, salt))
  if (cached) return cached.clone()
  const key = CryptoJS.PBKDF2(passphrase, salt, {
    keySize: KEY_SIZE / 4, // CryptoJS uses 32-bit words
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  })
  rememberKey(passphrase, salt, key)
  return key
}

function saltForWrite(passphrase: string): CryptoJS.lib.WordArray {
  return (
    writeSalts.get(passphraseId(passphrase))?.clone() ?? CryptoJS.lib.WordArray.random(SALT_SIZE)
  )
}

/** Соль записи v2; null — запись другого формата или битая. */
function saltOf(encryptedData: string): CryptoJS.lib.WordArray | null {
  if (!encryptedData.startsWith(V2_PREFIX)) return null
  try {
    const raw = CryptoJS.enc.Base64.parse(encryptedData.slice(V2_PREFIX.length))
    if (raw.sigBytes <= SALT_SIZE + IV_SIZE) return null
    return CryptoJS.lib.WordArray.create(raw.words.slice(0, SALT_SIZE / 4), SALT_SIZE)
  } catch {
    return null
  }
}

/**
 * Посчитать ключи записей заранее, пока идёт запуск. WebCrypto считает PBKDF2
 * вне главного потока и во много раз быстрее crypto-js; потом синхронное
 * decryptData этих записей и запись новых под тем же паролем ничего не стоят.
 * Не бросает: без WebCrypto ключи посчитаются как раньше, при чтении.
 */
export async function prewarmKeys(passphrase: string, encrypted: string[]): Promise<void> {
  const subtle = globalThis.crypto?.subtle
  if (!passphrase || !subtle) return
  const salts = new Map<string, CryptoJS.lib.WordArray>()
  for (const blob of encrypted) {
    const salt = blob ? saltOf(blob) : null
    if (salt && !derivedKeys.has(keyId(passphrase, salt))) salts.set(keyId(passphrase, salt), salt)
  }
  if (salts.size === 0) return
  try {
    const material = await subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    await Promise.all(
      [...salts.values()].map(async (salt) => {
        const bits = await subtle.deriveBits(
          {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: hexToBytes(CryptoJS.enc.Hex.stringify(salt)),
            iterations: PBKDF2_ITERATIONS,
          },
          material,
          KEY_SIZE * 8
        )
        rememberKey(passphrase, salt, CryptoJS.enc.Hex.parse(bytesToHex(new Uint8Array(bits))))
      })
    )
  } catch {
    // Посчитается при чтении, как раньше.
  }
}

/** Забыть посчитанные ключи — когда сейф закрыт или уничтожен. */
export function forgetKeys(): void {
  derivedKeys.clear()
  writeSalts.clear()
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
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
    const salt = saltForWrite(key)
    const iv = CryptoJS.lib.WordArray.random(IV_SIZE)
    const derivedKey = deriveKey(key, salt)

    const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })

    // Pack: salt + iv + ciphertext
    const combined = salt.concat(iv).concat(encrypted.ciphertext)

    return V2_PREFIX + CryptoJS.enc.Base64.stringify(combined)
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
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
      const iv = CryptoJS.lib.WordArray.create(
        rawWords.slice(SALT_SIZE / 4, (SALT_SIZE + IV_SIZE) / 4),
        IV_SIZE
      )
      const ciphertext = CryptoJS.lib.WordArray.create(
        rawWords.slice((SALT_SIZE + IV_SIZE) / 4),
        rawSigBytes - SALT_SIZE - IV_SIZE
      )

      const derivedKey = deriveKey(key, salt)

      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext })
      const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
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
      `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}
