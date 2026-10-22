// Ключи Ed25519 для IPNS: имя совпадает с тем, что даёт Kubo, запись,
// подписанная noble, проходит проверку Helia, и проверка работает там, где
// у WebCrypto нет Ed25519 (Android WebView 124, Safari 16).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIPNSRecord, IPNSEntry, ipnsValidator, multihashToIPNSRoutingKey } from '@helia/ipns'
import { compatKeychain, ed25519FromProtobuf, Ed25519PrivateKey } from './ipns-keys'

type Keychain = Parameters<typeof compatKeychain>[0]

const SEED = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
/** `ipfs key import` этого seed в Kubo 0.43.0 даёт такое имя. */
const KUBO_NAME = 'k51qzi5uqu5dj7skeind43o1an76ns1q5g2bupqw6o1hmcccenbkvalzo2olt0'
const VALUE = '/ipfs/bafkreihfcegubxdrpkij2p6gtgcbq5ygjq6hsnzycw46zk7cvoppsfyagu'

const helia = {
  loadPublicKeyFromProtobuf: vi.fn(async () => {
    throw new Error('not this key type')
  }),
} as unknown as Keychain

async function signed(key = new Ed25519PrivateKey(SEED)) {
  const record = await createIPNSRecord(key, VALUE, 1n, 60_000)
  return {
    routingKey: multihashToIPNSRoutingKey(key.publicKey.toMultihash()),
    bytes: IPNSEntry.encode(record),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ipns-keys', () => {
  it('имя ключа — как у Kubo', () => {
    expect(new Ed25519PrivateKey(SEED).publicKey.toName()).toBe(KUBO_NAME)
  })

  it('protobuf ключа читается обратно, чужой тип — нет', () => {
    const key = new Ed25519PrivateKey(SEED)
    expect(ed25519FromProtobuf(key.publicKey.toProtobuf())?.toName()).toBe(KUBO_NAME)
    expect(ed25519FromProtobuf(Uint8Array.from([0x08, 0x00, 0x12, 0x01, 0]))).toBeNull()
  })

  it('запись проходит проверку Helia и без Ed25519 в WebCrypto', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(
      new DOMException('', 'NotSupportedError')
    )
    const { routingKey, bytes } = await signed()
    const record = await ipnsValidator(routingKey, bytes, compatKeychain(helia))
    expect(record.sequence).toBe(1n)
    expect(crypto.subtle.importKey).not.toHaveBeenCalled()
  })

  it('подделанная запись не проходит', async () => {
    const { routingKey, bytes } = await signed()
    const other = await signed(new Ed25519PrivateKey(SEED.map((b) => b ^ 0xff)))
    // Запись другого ключа под этим именем.
    await expect(ipnsValidator(routingKey, other.bytes, compatKeychain(helia))).rejects.toThrow()
    const last = bytes.length - 1
    bytes[last] = (bytes[last] ?? 0) ^ 1
    await expect(ipnsValidator(routingKey, bytes, compatKeychain(helia))).rejects.toThrow()
  })

  it('ключи других типов проверяет keychain Helia', async () => {
    const rsa = Uint8Array.from([0x08, 0x00, 0x12, 0x01, 0])
    await expect(compatKeychain(helia).loadPublicKeyFromProtobuf(rsa)).rejects.toThrow(
      'not this key type'
    )
    expect(helia.loadPublicKeyFromProtobuf).toHaveBeenCalledWith(rsa, undefined)
  })
})
