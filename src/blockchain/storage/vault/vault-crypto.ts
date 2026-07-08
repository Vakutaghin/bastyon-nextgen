// Чистые WebCrypto-примитивы «сейфа» (vault) для P0-1. Framework-free, без
// зависимости от crypto-js/pinia — юнит-тестируемо под happy-dom (crypto.subtle есть).
//
// Роль: обернуть/развернуть 32-байтный секрет сейфа S либо под non-extractable
// device-ключом (AES-GCM, лежит в IndexedDB), либо под ключом из passphrase
// (PBKDF2 → AES-GCM). Сам S дальше отдаётся в НЕизменённый crypto-js слой
// (encryptData/decryptData) как base64-строка — payload'ы не перешифровываются.
//
// Инварианты: свежий 12-байтный IV на КАЖДУЮ обёртку; свежий 16-байтный salt на
// каждую деривацию из passphrase. Device-ключ всегда extractable:false.

export const AES_GCM = 'AES-GCM'
export const IV_BYTES = 12
export const SALT_BYTES = 16
export const SECRET_BYTES = 32
export const DEFAULT_PBKDF2_ITERATIONS = 600_000
export type Pbkdf2Hash = 'SHA-256' | 'SHA-512'

/** Обёртка секрета: base64(iv) + base64(ciphertext) AES-GCM. */
export interface WrapEnvelope {
  iv: string
  ct: string
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('vault: crypto.subtle unavailable')
  return s
}

/**
 * Есть ли рабочий WebCrypto. Используется для detection «degraded»-режима:
 * без subtle сейф не поднять, приложение падает на fingerprint (level 0).
 */
export function isSubtleAvailable(): boolean {
  return !!globalThis.crypto?.subtle && typeof globalThis.crypto.getRandomValues === 'function'
}

// ── base64 <-> bytes (btoa/atob есть в браузере, happy-dom и node 16+) ─────────

export function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  globalThis.crypto.getRandomValues(b)
  return b
}

/** 32 случайных байта — секрет сейфа S. */
export function generateSecret(): Uint8Array {
  return randomBytes(SECRET_BYTES)
}

/**
 * Non-extractable AES-GCM device-ключ. extractable:false → сырые байты нельзя
 * выгрузить в JS; ключ переживает перезагрузку в IndexedDB (structured clone).
 */
export function generateDeviceKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: AES_GCM, length: 256 }, false, ['encrypt', 'decrypt'])
}

/** Деривирует AES-GCM ключ из passphrase (PBKDF2). Ключ не extractable, используется разово. */
export async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
  hash: Pbkdf2Hash = 'SHA-256'
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash },
    material,
    { name: AES_GCM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Оборачивает секрет ключом (AES-GCM, свежий IV). */
export async function wrapSecret(key: CryptoKey, secret: Uint8Array): Promise<WrapEnvelope> {
  const iv = randomBytes(IV_BYTES)
  const ct = await subtle().encrypt(
    { name: AES_GCM, iv: iv as unknown as BufferSource },
    key,
    secret as unknown as BufferSource
  )
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) }
}

/** Разворачивает секрет. Бросает при неверном ключе/повреждении (AES-GCM auth). */
export async function unwrapSecret(key: CryptoKey, env: WrapEnvelope): Promise<Uint8Array> {
  const pt = await subtle().decrypt(
    { name: AES_GCM, iv: b64ToBytes(env.iv) as unknown as BufferSource },
    key,
    b64ToBytes(env.ct) as unknown as BufferSource
  )
  return new Uint8Array(pt)
}
