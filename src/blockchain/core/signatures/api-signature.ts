/**
 * Генерация подписей для API запросов
 */

import { Buffer } from 'buffer'
import type { KeyPair } from '../../types/keys'
import type { Address } from '../../types/addresses'
import type { ApiSignature, ApiSignatureOptions } from '../../types/signatures'
import { sha256, hexEncode } from '../../utils/crypto-hash'

/**
 * Генерирует случайное число в диапазоне
 * @param min - Минимальное значение
 * @param max - Максимальное значение
 * @returns Случайное число
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Получает текущее время в UTC
 * @returns Текущее время в формате ISO
 */
function getCurrentUTCTime(): string {
  return new Date().toISOString()
}

/**
 * Получает текущее время в миллисекундах
 * @returns Текущее время в миллисекундах
 */
function getCurrentTimeMillis(): number {
  return Date.now()
}

/**
 * Создает nonce для подписи
 * @param data - Данные для подписи
 * @param expiration - Время жизни в секундах
 * @param useOldFormat - Использовать старый формат
 * @returns Nonce строка
 */
function createNonce(
  data: string = 'pocketnetproxy',
  expiration: number = 360,
  useOldFormat: boolean = false
): string {
  if (useOldFormat) {
    // Старый формат: timestamp + случайные цифры до 32 символов
    let nonce = getCurrentTimeMillis().toString()
    while (nonce.length < 32) {
      nonce += randomInt(0, 9).toString()
    }
    return nonce
  } else {
    // Новый формат: date=ISO,exp=seconds,s=hex(data)
    const currentMomentInUTC = getCurrentUTCTime()
    const dataHex = hexEncode(data)
    return `date=${currentMomentInUTC},exp=${expiration},s=${dataHex}`
  }
}

/**
 * Генерирует подпись для API запросов
 * @param keyPair - Ключевая пара
 * @param address - Pocketnet адрес
 * @param options - Опции генерации подписи
 * @returns Объект подписи для API
 */
export function generateApiSignature(
  keyPair: KeyPair,
  address: Address,
  options: ApiSignatureOptions = {}
): ApiSignature {
  if (!keyPair || !keyPair.ecPair) {
    throw new Error('Valid key pair is required')
  }

  if (!address) {
    throw new Error('Address is required')
  }

  const {
    data = 'pocketnetproxy',
    expiration = 360,
    expirationShift = 160,
    useOldFormat = false,
    session = '',
  } = options

  // Создаем nonce
  const nonce = createNonce(session || data, expiration, useOldFormat)

  let signature: Buffer | Uint8Array

  if (useOldFormat) {
    // Старый формат: подпись nonce напрямую
    signature = keyPair.ecPair.sign(Buffer.from(nonce))
  } else {
    // Новый формат: подпись SHA256 хеша nonce
    const hash = sha256(nonce)
    signature = keyPair.ecPair.sign(hash)
  }

  // Формируем объект подписи
  // ВАЖНО: Убеждаемся, что signature - это строка, а не Buffer
  // Buffer при JSON.stringify может сериализоваться как массив чисел
  const signatureHex = Buffer.isBuffer(signature)
    ? signature.toString('hex')
    : typeof signature === 'string'
    ? signature
    : Buffer.from(signature as any).toString('hex')

  const pubkeyHex = Buffer.isBuffer(keyPair.publicKey)
    ? keyPair.publicKey.toString('hex')
    : typeof keyPair.publicKey === 'string'
    ? keyPair.publicKey
    : Buffer.from(keyPair.publicKey as any).toString('hex')

  const signatureObj: ApiSignature = {
    nonce,
    signature: signatureHex,
    pubkey: pubkeyHex,
    address,
    v: 1,
  }

  // В старом формате не добавляем версию
  if (useOldFormat) {
    delete (signatureObj as Partial<ApiSignature>).v
  }

  return signatureObj
}

/**
 * Валидирует API подпись
 * Проверяет формат и время истечения
 * @param signature - Объект подписи
 * @returns Результат валидации
 */
export function validateApiSignature(signature: ApiSignature): {
  isValid: boolean
  isExpired?: boolean
  expirationTime?: Date
  error?: string
} {
  if (!signature) {
    return {
      isValid: false,
      error: 'Signature is required',
    }
  }

  if (!signature.nonce || !signature.signature || !signature.pubkey || !signature.address) {
    return {
      isValid: false,
      error: 'Invalid signature format',
    }
  }

  // Проверка времени истечения (только для нового формата)
  if (signature.v === 1 && signature.nonce.includes('exp=')) {
    try {
      const expMatch = signature.nonce.match(/exp=(\d+)/)
      if (expMatch) {
        const expirationSeconds = parseInt(expMatch[1], 10)
        const dateMatch = signature.nonce.match(/date=([^,]+)/)
        if (dateMatch) {
          const signatureTime = new Date(dateMatch[1])
          const expirationTime = new Date(signatureTime.getTime() + expirationSeconds * 1000)
          const now = new Date()

          if (now > expirationTime) {
            return {
              isValid: false,
              isExpired: true,
              expirationTime,
              error: 'Signature has expired',
            }
          }

          return {
            isValid: true,
            isExpired: false,
            expirationTime,
          }
        }
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to parse expiration: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  // Для старого формата или если не удалось распарсить - считаем валидным по формату
  return {
    isValid: true,
  }
}
