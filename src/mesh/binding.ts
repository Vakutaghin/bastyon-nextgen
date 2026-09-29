/**
 * Связка аккаунта Bastyon с адресом в mesh-сети: Reticulum (LXMF), MeshCore
 * или Meshtastic.
 *
 * Адрес в mesh-сети по публичным данным аккаунта не вычислить (у LXMF он
 * выведен из ключа аккаунта, у радио — ключ самого радио). Поэтому человек
 * сообщает его собеседнику записью связки: адрес Bastyon, публичный ключ
 * аккаунта, сеть, адрес и ключ в ней. Запись подписана ключом аккаунта
 * (secp256k1, как транзакции) — «это мой адрес»: подделать связку с чужим
 * аккаунтом нельзя, значит, перехватить чужую переписку — тоже.
 *
 * Где можно, подписывает и сам адрес — «этот адрес согласен»:
 * - Reticulum — ключом identity (Ed25519), всегда;
 * - MeshCore — ключом радио (CMD_SIGN_*), если прошивка это умеет;
 * - Meshtastic — никак: подписать ключом узла со стороны приложения нельзя.
 *   Указать чужой узел значит только направить своих собеседников к чужому
 *   радио — вред лишь себе.
 *
 * Проверяется запись без сети и без радио.
 */

import { ed25519, x25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { Buffer } from 'buffer'

import { generatePocketnetAddress } from '@/blockchain/core/addresses/address-generator'

const ECPair = ECPairFactory(ecc)

export type MeshNet = 'lxmf' | 'meshcore' | 'meshtastic'

export interface MeshBinding {
  v: 1
  net: MeshNet
  /** Адрес Bastyon (P…). */
  bastyon: string
  /** Сжатый публичный ключ аккаунта, hex (33 байта). */
  pub: string
  /**
   * Адрес в сети, hex: LXMF — адрес доставки (16 байт); MeshCore — ключ радио
   * (32 байта); Meshtastic — номер узла (4 байта).
   */
  dest: string
  /**
   * Ключ в сети, hex: LXMF — ключ identity (64 байта: X25519 и Ed25519);
   * MeshCore — тот же ключ радио; Meshtastic — ключ узла для ЛС (X25519).
   */
  key: string
  /** Когда подписана, секунды Unix: из двух связок одной сети новее верна. */
  ts: number
  /** Подпись аккаунта над sha256(текста записи): secp256k1, 64 байта, hex. */
  sig: string
  /** Подпись адреса над текстом записи (Ed25519, hex): LXMF — всегда, MeshCore — если есть. */
  rsig?: string
}

type Unsigned = Omit<MeshBinding, 'sig' | 'rsig'>

/** Что подписывается: всё, кроме подписей, одной строкой. */
export function bindingText(b: Unsigned): Uint8Array {
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

export interface AccountKeys {
  /** Адрес аккаунта Bastyon. */
  address: string
  /** Ключ аккаунта: 32 байта приватного и сжатый публичный. */
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export interface BindingKeys extends AccountKeys {
  /** Identity Reticulum, 64 байта (deriveRnsIdentity). */
  identity: Uint8Array
}

function unsigned(
  account: AccountKeys,
  net: MeshNet,
  dest: string,
  key: string,
  ts: number
): Unsigned {
  return {
    v: 1,
    net,
    bastyon: account.address,
    pub: bytesToHex(account.publicKey),
    dest: dest.toLowerCase(),
    key: key.toLowerCase(),
    ts,
  }
}

function accountSig(account: AccountKeys, text: Uint8Array): string {
  return bytesToHex(ECPair.fromPrivateKey(account.privateKey).sign(sha256(text)))
}

/** Связка с адресом LXMF: подписана аккаунтом и identity Reticulum. */
export function signBinding(keys: BindingKeys, ts = Math.floor(Date.now() / 1000)): MeshBinding {
  const key = rnsPublicKey(keys.identity)
  const body = unsigned(keys, 'lxmf', lxmfAddressOf(key), bytesToHex(key), ts)
  const text = bindingText(body)
  return {
    ...body,
    sig: accountSig(keys, text),
    rsig: bytesToHex(ed25519.sign(text, keys.identity.slice(32, 64))),
  }
}

/**
 * Связка с радио MeshCore: подписана аккаунтом и, если радио умеет
 * (`sign` — CMD_SIGN_*, null — не умеет), самим радио.
 */
export async function signMeshCoreBinding(
  account: AccountKeys,
  radioKey: string,
  sign: ((text: Uint8Array) => Promise<Uint8Array | null>) | null,
  ts = Math.floor(Date.now() / 1000)
): Promise<MeshBinding> {
  const body = unsigned(account, 'meshcore', radioKey, radioKey, ts)
  const text = bindingText(body)
  const radioSig = sign ? await sign(text).catch(() => null) : null
  return {
    ...body,
    sig: accountSig(account, text),
    ...(radioSig ? { rsig: bytesToHex(radioSig) } : {}),
  }
}

/** Связка с узлом Meshtastic (номер и ключ ЛС): подписана аккаунтом. */
export function signMeshtasticBinding(
  account: AccountKeys,
  nodeNum: number,
  publicKey: string,
  ts = Math.floor(Date.now() / 1000)
): MeshBinding {
  const body = unsigned(
    account,
    'meshtastic',
    (nodeNum >>> 0).toString(16).padStart(8, '0'),
    publicKey,
    ts
  )
  return { ...body, sig: accountSig(account, bindingText(body)) }
}

const HEX = (len: number) => new RegExp(`^[0-9a-f]{${len * 2}}$`)

/** Размеры адреса и ключа в каждой сети, байт. */
const SIZES: Record<MeshNet, { dest: number; key: number }> = {
  lxmf: { dest: 16, key: 64 },
  meshcore: { dest: 32, key: 32 },
  meshtastic: { dest: 4, key: 32 },
}

/**
 * Проверенная связка или null. Проверяется всё: адрес Bastyon — из ключа
 * аккаунта, подпись аккаунта; LXMF — адрес из ключа identity и её подпись;
 * MeshCore — подпись радио, если есть.
 */
export function verifyBinding(raw: unknown): MeshBinding | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<MeshBinding>
  const sizes = b.net ? SIZES[b.net] : undefined
  if (
    b.v !== 1 ||
    !sizes ||
    typeof b.bastyon !== 'string' ||
    typeof b.ts !== 'number' ||
    !Number.isSafeInteger(b.ts) ||
    !HEX(33).test(b.pub ?? '') ||
    !HEX(sizes.dest).test(b.dest ?? '') ||
    !HEX(sizes.key).test(b.key ?? '') ||
    !HEX(64).test(b.sig ?? '') ||
    (b.rsig !== undefined && !HEX(64).test(b.rsig)) ||
    (b.net === 'lxmf' && b.rsig === undefined) ||
    (b.net === 'meshtastic' && b.rsig !== undefined)
  ) {
    return null
  }
  const binding = b as MeshBinding
  try {
    const pub = Buffer.from(hexToBytes(binding.pub))
    if (generatePocketnetAddress(pub).address !== binding.bastyon) return null
    const text = bindingText(binding)
    const account = ECPair.fromPublicKey(hexToBytes(binding.pub))
    if (!account.verify(sha256(text), hexToBytes(binding.sig))) return null
    const key = hexToBytes(binding.key)
    if (binding.net === 'lxmf') {
      if (lxmfAddressOf(key) !== binding.dest) return null
      if (!ed25519.verify(hexToBytes(binding.rsig!), text, key.slice(32, 64))) return null
    } else if (binding.net === 'meshcore') {
      if (binding.key !== binding.dest) return null
      if (binding.rsig && !ed25519.verify(hexToBytes(binding.rsig), text, key)) return null
    }
  } catch {
    return null
  }
  return {
    v: 1,
    net: binding.net,
    bastyon: binding.bastyon,
    pub: binding.pub,
    dest: binding.dest,
    key: binding.key,
    ts: binding.ts,
    sig: binding.sig,
    ...(binding.rsig ? { rsig: binding.rsig } : {}),
  }
}
