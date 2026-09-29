/**
 * Связка аккаунта Bastyon с адресом Reticulum (LXMF).
 *
 * Адрес LXMF выводится из ключа аккаунта (reticulum/identity.ts), но по
 * публичным данным его не вычислить. Поэтому человек сообщает его собеседнику
 * записью связки: адрес Bastyon, публичный ключ аккаунта, адрес LXMF и
 * публичный ключ Reticulum. Запись подписана обоими ключами:
 * - ключом аккаунта (secp256k1, как транзакции) — «это мой адрес LXMF»;
 * - ключом Reticulum (Ed25519) — «этот адрес LXMF согласен».
 * Подделать связку с чужим аккаунтом или чужим адресом LXMF нельзя, а
 * проверяется она без сети и без узла Reticulum.
 */

import { ed25519, x25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { Buffer } from 'buffer'

import { generatePocketnetAddress } from '@/blockchain/core/addresses/address-generator'

const ECPair = ECPairFactory(ecc)

export interface MeshBinding {
  v: 1
  net: 'lxmf'
  /** Адрес Bastyon (P…). */
  bastyon: string
  /** Сжатый публичный ключ аккаунта, hex (33 байта). */
  pub: string
  /** Адрес LXMF (delivery destination), hex. */
  dest: string
  /** Публичный ключ identity Reticulum, hex: 32 байта X25519 и 32 — Ed25519. */
  key: string
  /** Когда подписана, секунды Unix: из двух связок одного человека верна новая. */
  ts: number
  /** Подпись аккаунта над sha256(текста записи): secp256k1, 64 байта, hex. */
  sig: string
  /** Подпись Reticulum над текстом записи: Ed25519, 64 байта, hex. */
  rsig: string
}

/** Что подписывается: всё, кроме подписей, одной строкой. */
function signedText(b: Omit<MeshBinding, 'sig' | 'rsig'>): Uint8Array {
  return utf8ToBytes(
    ['bastyon-mesh-binding/1', b.net, b.bastyon, b.pub, b.dest, b.key, String(b.ts)].join('\n')
  )
}

const LXMF_DELIVERY_NAME_HASH = sha256(utf8ToBytes('lxmf.delivery')).slice(0, 10)

/** Хэш identity Reticulum: первые 16 байт sha256 публичного ключа (64 байта). */
export function rnsIdentityHash(publicKey: Uint8Array): Uint8Array {
  return sha256(publicKey).slice(0, 16)
}

/** Адрес LXMF (lxmf.delivery) по публичному ключу identity — как у RNS. */
export function lxmfAddressOf(publicKey: Uint8Array): string {
  const material = new Uint8Array(26)
  material.set(LXMF_DELIVERY_NAME_HASH)
  material.set(rnsIdentityHash(publicKey), 10)
  return bytesToHex(sha256(material).slice(0, 16))
}

/** Публичный ключ identity по приватному (64 байта: X25519 и сид Ed25519). */
export function rnsPublicKey(identity: Uint8Array): Uint8Array {
  const out = new Uint8Array(64)
  out.set(x25519.getPublicKey(identity.slice(0, 32)))
  out.set(ed25519.getPublicKey(identity.slice(32, 64)), 32)
  return out
}

export interface BindingKeys {
  /** Адрес аккаунта Bastyon. */
  address: string
  /** Ключ аккаунта: 32 байта приватного и сжатый публичный. */
  privateKey: Uint8Array
  publicKey: Uint8Array
  /** Identity Reticulum, 64 байта (deriveRnsIdentity). */
  identity: Uint8Array
}

export function signBinding(keys: BindingKeys, ts = Math.floor(Date.now() / 1000)): MeshBinding {
  const key = rnsPublicKey(keys.identity)
  const body = {
    v: 1 as const,
    net: 'lxmf' as const,
    bastyon: keys.address,
    pub: bytesToHex(keys.publicKey),
    dest: lxmfAddressOf(key),
    key: bytesToHex(key),
    ts,
  }
  const text = signedText(body)
  const account = ECPair.fromPrivateKey(keys.privateKey)
  return {
    ...body,
    sig: bytesToHex(account.sign(sha256(text))),
    rsig: bytesToHex(ed25519.sign(text, keys.identity.slice(32, 64))),
  }
}

const HEX = (len: number) => new RegExp(`^[0-9a-f]{${len * 2}}$`)

/**
 * Проверенная связка или null. Проверяется всё: адрес Bastyon — из ключа
 * аккаунта, адрес LXMF — из ключа Reticulum, обе подписи.
 */
export function verifyBinding(raw: unknown): MeshBinding | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<MeshBinding>
  if (
    b.v !== 1 ||
    b.net !== 'lxmf' ||
    typeof b.bastyon !== 'string' ||
    typeof b.ts !== 'number' ||
    !Number.isSafeInteger(b.ts) ||
    !HEX(33).test(b.pub ?? '') ||
    !HEX(16).test(b.dest ?? '') ||
    !HEX(64).test(b.key ?? '') ||
    !HEX(64).test(b.sig ?? '') ||
    !HEX(64).test(b.rsig ?? '')
  ) {
    return null
  }
  const binding = b as MeshBinding
  try {
    const pub = Buffer.from(hexToBytes(binding.pub))
    if (generatePocketnetAddress(pub).address !== binding.bastyon) return null
    const key = hexToBytes(binding.key)
    if (lxmfAddressOf(key) !== binding.dest) return null
    const text = signedText(binding)
    const account = ECPair.fromPublicKey(hexToBytes(binding.pub))
    if (!account.verify(sha256(text), hexToBytes(binding.sig))) return null
    if (!ed25519.verify(hexToBytes(binding.rsig), text, key.slice(32, 64))) return null
  } catch {
    return null
  }
  return {
    v: 1,
    net: 'lxmf',
    bastyon: binding.bastyon,
    pub: binding.pub,
    dest: binding.dest,
    key: binding.key,
    ts: binding.ts,
    sig: binding.sig,
    rsig: binding.rsig,
  }
}
