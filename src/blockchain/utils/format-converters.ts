/**
 * Конвертеры между различными форматами ключей
 */

// Полифилл для Buffer
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer
}
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer
}

import type { Network } from '../types/btc17-types'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'

// Инициализируем ECPair
const ECPair = ECPairFactory(ecc)

/**
 * Конвертирует hex строку в WIF формат
 * @param hex - Hex строка приватного ключа (64 символа)
 * @param network - Сеть (по умолчанию bitcoin mainnet)
 * @returns WIF строка
 */
export function hexToWif(hex: string, network?: Network): string {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Hex string is required')
  }

  const normalized = hex.toLowerCase().trim()

  // Проверка формата hex
  const hexPattern = /^[0-9a-f]{64}$/i
  if (!hexPattern.test(normalized)) {
    throw new Error('Invalid hex format (must be 64 hex characters)')
  }

  try {
    const privateKeyBuffer = Buffer.from(normalized, 'hex')

    // Проверка длины (32 байта)
    if (privateKeyBuffer.length !== 32) {
      throw new Error('Invalid private key length')
    }

    // Создаем ключевую пару и конвертируем в WIF
    const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network })
    return keyPair.toWIF()
  } catch (error) {
    throw new Error(
      `Failed to convert hex to WIF: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Конвертирует WIF строку в hex формат
 * @param wif - WIF строка
 * @returns Hex строка приватного ключа
 */
export function wifToHex(wif: string): string {
  if (!wif || typeof wif !== 'string') {
    throw new Error('WIF string is required')
  }

  try {
    const keyPair = ECPair.fromWIF(wif)
    
    if (!keyPair.privateKey) {
      throw new Error('Failed to extract private key from WIF')
    }

    return keyPair.privateKey.toString('hex')
  } catch (error) {
    throw new Error(
      `Failed to convert WIF to hex: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Конвертирует Buffer в hex строку
 * @param buffer - Buffer для конвертации
 * @returns Hex строка
 */
export function bufferToHex(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Buffer is required')
  }
  return buffer.toString('hex')
}

/**
 * Конвертирует hex строку в Buffer
 * @param hex - Hex строка
 * @returns Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Hex string is required')
  }

  const normalized = hex.toLowerCase().trim()
  const hexPattern = /^[0-9a-f]+$/i

  if (!hexPattern.test(normalized)) {
    throw new Error('Invalid hex format')
  }

  return Buffer.from(normalized, 'hex')
}

/**
 * Конвертирует строку в base64
 * @param str - Строка для конвертации
 * @returns Base64 строка
 */
export function stringToBase64(str: string): string {
  if (typeof str !== 'string') {
    throw new Error('String is required')
  }

  if (typeof btoa !== 'undefined') {
    // Браузер
    return btoa(unescape(encodeURIComponent(str)))
  } else {
    // Node.js
    return Buffer.from(str, 'utf-8').toString('base64')
  }
}

/**
 * Конвертирует base64 в строку
 * @param base64 - Base64 строка
 * @returns Декодированная строка
 */
export function base64ToString(base64: string): string {
  if (typeof base64 !== 'string') {
    throw new Error('Base64 string is required')
  }

  if (typeof atob !== 'undefined') {
    // Браузер
    return decodeURIComponent(escape(atob(base64)))
  } else {
    // Node.js
    return Buffer.from(base64, 'base64').toString('utf-8')
  }
}

/**
 * Конвертирует Buffer в base64
 * @param buffer - Buffer для конвертации
 * @returns Base64 строка
 */
export function bufferToBase64(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Buffer is required')
  }
  return buffer.toString('base64')
}

/**
 * Конвертирует base64 в Buffer
 * @param base64 - Base64 строка
 * @returns Buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  if (typeof base64 !== 'string') {
    throw new Error('Base64 string is required')
  }
  return Buffer.from(base64, 'base64')
}

/**
 * Конвертирует hex в base64
 * @param hex - Hex строка
 * @returns Base64 строка
 */
export function hexToBase64(hex: string): string {
  return bufferToBase64(hexToBuffer(hex))
}

/**
 * Конвертирует base64 в hex
 * @param base64 - Base64 строка
 * @returns Hex строка
 */
export function base64ToHex(base64: string): string {
  return bufferToHex(base64ToBuffer(base64))
}

/**
 * Нормализует hex строку (убирает пробелы, приводит к нижнему регистру)
 * @param hex - Hex строка
 * @returns Нормализованная hex строка
 */
export function normalizeHex(hex: string): string {
  if (!hex || typeof hex !== 'string') {
    return ''
  }
  return hex.toLowerCase().trim().replace(/\s+/g, '')
}

/**
 * Проверяет, является ли строка валидным hex
 * @param str - Строка для проверки
 * @returns true если валиден, false иначе
 */
export function isValidHex(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false
  }

  const normalized = normalizeHex(str)
  const hexPattern = /^[0-9a-f]+$/i
  return hexPattern.test(normalized)
}
