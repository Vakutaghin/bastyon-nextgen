/**
 * Identity Reticulum из ключа аккаунта Bastyon.
 *
 * Адрес в Reticulum — хэш identity (пара ключей X25519 + Ed25519). Его
 * выводим из приватного ключа аккаунта (HKDF-SHA256 с меткой домена), а не
 * создаём случайно: так мнемоника восстанавливает и Reticulum-адрес на
 * любом устройстве — «только мнемоника», как всё в Bastyon.
 *
 * Метка домена отделяет этот ключ от любых других выводов из того же
 * ключа: утечка identity Reticulum не раскрывает ключ аккаунта.
 */

const SALT = 'bastyon/reticulum/identity'
const INFO = 'v1'

/** 64 байта: 32 — приватный X25519, 32 — сид Ed25519 (порядок RNS Identity). */
export async function deriveRnsIdentity(accountPrivateKey: Uint8Array): Promise<Uint8Array> {
  if (accountPrivateKey.length !== 32) throw new RangeError('account key must be 32 bytes')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    accountPrivateKey as BufferSource,
    'HKDF',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(SALT), info: enc.encode(INFO) },
    key,
    512
  )
  return new Uint8Array(bits)
}
