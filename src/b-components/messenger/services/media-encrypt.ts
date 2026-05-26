import { PcryptoService, type User as PcryptoUser } from './pcrypto'

/**
 * Совместимость с bastyon-chat и forta.chat:
 * - blob шифруется AES-CBC (PBKDF2(secretStr, 'matrix.pocketnet', 10000) -> 256-bit key, фиксированный IV).
 * - secretStr оборачивается через PcryptoService.encryptKey() для всех участников комнаты.
 * - результат secrets кладётся в info.secrets отправляемого Matrix-события.
 */

const PBKDF2_SALT = 'matrix.pocketnet'
const PBKDF2_ITERATIONS = 10000
const FIXED_IV = new Uint8Array([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34])
const SECRETS_VERSION = 2

export interface EncryptedBlobResult {
  encryptedBlob: Blob
  /** hex-строка 64 символа (32 байта рандома) */
  secretStr: string
}

export interface RoomKeyWrapResult {
  keys: string
  block: number
  v: number
}

/**
 * Шифрует blob случайным AES-CBC ключом, возвращает зашифрованный blob и hex-строку ключа.
 * Дальше ключ нужно завернуть через wrapKeyForRoom() и положить в info.secrets.
 */
export const encryptBlobWithRandomKey = async (blob: Blob): Promise<EncryptedBlobResult> => {
  const enc = new TextEncoder()
  const rand = crypto.getRandomValues(new Uint8Array(32))
  const secretStr = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

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

  const plainBuffer = await blob.arrayBuffer()
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: FIXED_IV },
    derivedKey,
    plainBuffer
  )
  const encryptedBlob = new Blob([cipherBuffer], { type: 'application/octet-stream' })

  return { encryptedBlob, secretStr }
}

/**
 * Заворачивает AES-ключ для группы участников комнаты через pcrypto.
 * users — упорядоченный список членов с публичными ключами (см. getOrderedMemberIds в store).
 */
export const wrapKeyForRoom = async (
  pcrypto: PcryptoService,
  secretStr: string,
  users: PcryptoUser[],
  block: number,
  version: number = SECRETS_VERSION
): Promise<RoomKeyWrapResult> => {
  return pcrypto.encryptKey(secretStr, users, block, version)
}
