// Ключи Ed25519 для имён IPNS без WebCrypto.
//
// Helia проверяет подпись записи IPNS через WebCrypto Ed25519, а он есть
// только с Chrome 137 и Safari 17. В Android WebView 124 правильное имя
// открывалось с «не прошла проверку подписи» (эмулятор, 22.10.2026); так же
// было бы в Safari 16 и WKWebView на macOS 13. @noble/curves работает везде,
// поэтому и проверка, и подпись своих имён идут через него.
import { ed25519 } from '@noble/curves/ed25519'
import { base36 } from 'multiformats/bases/base36'
import { base64url } from 'multiformats/bases/base64'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import type { ipnsResolver } from '@helia/ipns'
import type { PrivateKey, PublicKey } from 'helia'

type Keychain = Parameters<typeof ipnsResolver>[0]['keychain']

/** Тип ключа Ed25519 в protobuf ключей libp2p. */
const ED25519 = 1
/** codec libp2p-key: так в CID записан ключ имени IPNS. */
const LIBP2P_KEY = 0x72

/** protobuf ключа libp2p: поле 1 — тип, поле 2 — байты ключа. */
function keyProtobuf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([0x08, ED25519, 0x12, bytes.length, ...bytes])
}

export class Ed25519PublicKey implements PublicKey {
  readonly type = 'Ed25519'
  readonly code = ED25519

  constructor(readonly raw: Uint8Array) {}

  toProtobuf(): Uint8Array<ArrayBuffer> {
    return keyProtobuf(this.raw)
  }

  toMultihash() {
    return identity.digest(this.toProtobuf())
  }

  toCID(): CID<unknown, 0x72, 0x00, 1> {
    return CID.createV1(LIBP2P_KEY, this.toMultihash())
  }

  toJWK(): JsonWebKey {
    return { kty: 'OKP', crv: 'Ed25519', x: base64url.baseEncode(this.raw) }
  }

  verify(message: Uint8Array, signature: Uint8Array): boolean {
    try {
      return ed25519.verify(signature, message, this.raw)
    } catch {
      return false
    }
  }

  /** Имя IPNS этого ключа: `k51…`. */
  toName(): string {
    return this.toCID().toString(base36)
  }
}

export class Ed25519PrivateKey implements PrivateKey {
  readonly type = 'Ed25519'
  readonly code = ED25519
  readonly publicKey: Ed25519PublicKey

  /** seed — 32 байта закрытого ключа. */
  constructor(private readonly seed: Uint8Array) {
    this.publicKey = new Ed25519PublicKey(ed25519.getPublicKey(seed))
  }

  toProtobuf(): Uint8Array<ArrayBuffer> {
    return keyProtobuf(Uint8Array.from([...this.seed, ...this.publicKey.raw]))
  }

  toJWK(): JsonWebKey {
    return { ...this.publicKey.toJWK(), d: base64url.baseEncode(this.seed) }
  }

  sign(message: Uint8Array): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(ed25519.sign(message, this.seed))
  }
}

/** Открытый ключ Ed25519 из protobuf libp2p; другой тип или размер — null. */
export function ed25519FromProtobuf(buf: Uint8Array): Ed25519PublicKey | null {
  const isEd25519 = buf.length === 36 && buf[0] === 0x08 && buf[1] === ED25519 && buf[2] === 0x12
  return isEd25519 && buf[3] === 32 ? new Ed25519PublicKey(buf.slice(4)) : null
}

/** Keychain для проверки записей IPNS: Ed25519 — через noble, остальное — как у Helia. */
export function compatKeychain(keychain: Keychain): Keychain {
  const load: Keychain['loadPublicKeyFromProtobuf'] = async (buf, options) =>
    ed25519FromProtobuf(buf) ?? keychain.loadPublicKeyFromProtobuf(buf, options)
  // Остальные методы — у самого keychain: у него приватные поля.
  return new Proxy(keychain, {
    get(target, prop) {
      if (prop === 'loadPublicKeyFromProtobuf') return load
      const value: unknown = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
