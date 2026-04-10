/**
 * Shared cryptographic hash utilities.
 * Centralizes SHA256 and hex encoding so that address-validator.ts
 * and api-signature.ts don't duplicate CryptoJS boilerplate.
 */

import { Buffer } from './buffer-polyfill'
import CryptoJS from 'crypto-js'

/**
 * Вычисляет одинарный SHA256 хеш
 * @param data - Строка или Buffer для хеширования
 * @returns Buffer с результатом хеша
 */
export function sha256(data: string | Buffer): Buffer {
  const input =
    typeof data === 'string'
      ? data
      : CryptoJS.enc.Hex.parse(data.toString('hex'))
  const hash = CryptoJS.SHA256(input)
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
}

/**
 * Вычисляет двойной SHA256 хеш (SHA256(SHA256(data)))
 * Используется для валидации адресов (Bitcoin-стиль checksum)
 * @param data - Buffer для хеширования
 * @returns Buffer с результатом двойного хеша
 */
export function hash256(data: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(data.toString('hex'))
  const hash = CryptoJS.SHA256(CryptoJS.SHA256(wordArray))
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
}

/**
 * Кодирует строку в hex формат (посимвольно)
 * @param str - Строка для кодирования
 * @returns Hex строка
 */
export function hexEncode(str: string): string {
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    hex += charCode.toString(16).padStart(2, '0')
  }
  return hex
}
