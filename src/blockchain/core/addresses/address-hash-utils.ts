/**
 * Низкоуровневые криптографические утилиты для формирования адресов:
 * двойной SHA-256, hash160 (SHA-256 + RIPEMD-160), Base58Check, Bech32.
 *
 * Реализованы вручную, чтобы обойти typeforce-валидации bitcoinjs-lib
 * на network-объекты и работать с Pocketnet-сетью напрямую.
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
// @ts-expect-error - no types for bs58/bech32
import bs58 from 'bs58'
// bech32 экспортирует только именованные { bech32, bech32m } — дефолтного
// экспорта нет, поэтому `import bech32 from 'bech32'` давал namespace без
// .toWords/.encode и ронял toBech32() (генерацию P2WPKH-адресов).
// @ts-expect-error - no types for bs58/bech32
import { bech32 } from 'bech32'
import CryptoJS from 'crypto-js'

export function localHash256(buffer: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(buffer.toString('hex'))
  const hash = CryptoJS.SHA256(CryptoJS.SHA256(wordArray))
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex')
}

export function localHash160(buffer: Buffer): Buffer {
  const wordArray = CryptoJS.enc.Hex.parse(buffer.toString('hex'))
  const sha256 = CryptoJS.SHA256(wordArray)
  const ripemd160 = CryptoJS.RIPEMD160(sha256)
  return Buffer.from(ripemd160.toString(CryptoJS.enc.Hex), 'hex')
}

/**
 * Ручной Base58Check: payload = [version | hash], checksum = первые 4 байта double-SHA256(payload).
 * Используется вместо bitcoinjs.address.toBase58Check, чтобы избежать typeforce проверок network.
 */
export function toBase58Check(hash: Buffer, version: number): string {
  const payload = Buffer.allocUnsafe(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  const checksum = localHash256(payload).slice(0, 4)
  const data = Buffer.concat([payload, checksum])

  return bs58.encode(data)
}

export function toBech32(hash: Buffer, version: number, prefix: string): string {
  const words = bech32.toWords(hash)
  words.unshift(version)
  return bech32.encode(prefix, words)
}
