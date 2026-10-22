// Свои имена IPNS — «Постоянная ссылка» в «Моих файлах»: ссылка ipns://k51…,
// которую владелец переводит на новую версию файла, а сама ссылка не меняется.
//
// Ключ имени выводится из ключа аккаунта — HKDF-SHA256 со своей меткой и
// номером имени, как из того же ключа выводятся ключи мессенджера:
//  - имя одно на всех устройствах аккаунта и восстанавливается вместе с ним;
//  - по имени нельзя узнать адрес аккаунта;
//  - имён сколько угодно, у каждого свой номер.
//
// Запись подписывается здесь (noble, см. ipns-keys.ts) и уходит в delegated
// routing запросом PUT /routing/v1/ipns: сервис кладёт её в DHT. С модулем
// IPFS её кладёт в DHT и свой Kubo (ipfs_name_put в Rust).
//
// В DHT запись живёт около 48 часов, поэтому свои имена приложение переиздаёт
// само (ipns-names-store.ts), а срок записи — 30 дней: имя переживает
// перерывы, пока запись переиздаёт кто-то ещё.
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { createIPNSRecord, IPNSEntry, ipnsValidator, multihashToIPNSRoutingKey } from '@helia/ipns'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import { ed25519FromProtobuf, Ed25519PrivateKey, type Ed25519PublicKey } from './ipns-keys'
import { IPNS_ROUTER } from './ipfs-network'

const DAY = 86_400_000
export const NAME_LIFETIME_MS = 30 * DAY
/** Осталось меньше — запись подписывается заново, а не переиздаётся как есть. */
export const RESIGN_BEFORE_MS = 15 * DAY
/** Сколько резолверы держат запись в кэше: новую версию увидят через минуты. */
const NAME_TTL_NS = 5n * 60n * 1_000_000_000n
const RECORD_TYPE = 'application/vnd.ipfs.ipns-record'
const HKDF_SALT = 'bastyon/ipns'
/** codec libp2p-key: так в CID записан ключ имени IPNS. */
const LIBP2P_KEY = 0x72

type Keychain = Parameters<typeof ipnsValidator>[2]

/** Свои имена — только Ed25519: другой ключ под таким именем — подделка. */
const OWN_KEYS = {
  loadPublicKeyFromProtobuf: async (buf: Uint8Array) => {
    const key = ed25519FromProtobuf(buf)
    if (!key) throw new Error('not an Ed25519 key')
    return key
  },
} as unknown as Keychain

export interface NameRecord {
  /** `k51…` */
  name: string
  /** Куда ведёт имя: `/ipfs/<cid>/<путь>`. */
  value: string
  sequence: bigint
  validUntil: Date
  bytes: Uint8Array
}

/** Ключ имени номер `index` этого аккаунта. */
export function nameKey(accountKey: Uint8Array, index: number): Ed25519PrivateKey {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError(`bad name index ${index}`)
  return new Ed25519PrivateKey(hkdf(sha256, accountKey, HKDF_SALT, `name/${index}`, 32))
}

/** Открытый ключ имени `k51…`; не Ed25519 — null. */
function publicKeyOf(name: string): Ed25519PublicKey | null {
  try {
    const cid = CID.parse(name, base36)
    return cid.code === LIBP2P_KEY && cid.multihash.code === 0
      ? ed25519FromProtobuf(cid.multihash.digest)
      : null
  } catch {
    return null
  }
}

/** RFC 3339 с наносекундами → Date (Safari не разбирает больше трёх знаков дроби). */
export function recordValidity(bytes: Uint8Array | undefined): Date | null {
  if (!bytes?.length) return null
  const text = new TextDecoder().decode(bytes).replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function signRecord(
  key: Ed25519PrivateKey,
  value: string,
  sequence: bigint,
  now = Date.now()
): Promise<NameRecord> {
  const record = await createIPNSRecord(key, value, sequence, NAME_LIFETIME_MS, {
    ttlNs: NAME_TTL_NS,
    now,
  })
  return {
    name: key.publicKey.toName(),
    value,
    sequence,
    validUntil: new Date(now + NAME_LIFETIME_MS),
    bytes: IPNSEntry.encode(record),
  }
}

/** Проверенная запись имени; подпись не та, срок вышел — исключение. */
export async function parseRecord(name: string, bytes: Uint8Array): Promise<NameRecord> {
  const key = publicKeyOf(name)
  if (!key) throw new Error(`not an Ed25519 IPNS name: ${name.slice(0, 64)}`)
  const record = await ipnsValidator(multihashToIPNSRoutingKey(key.toMultihash()), bytes, OWN_KEYS)
  const validUntil = recordValidity(record.validity)
  // Подписи V1+V2: значение, номер и срок есть и в полях protobuf.
  if (record.value == null || record.sequence == null || !validUntil) {
    throw new Error('IPNS record without V1 fields')
  }
  return {
    name,
    value: new TextDecoder().decode(record.value),
    sequence: record.sequence,
    validUntil,
    bytes,
  }
}

/**
 * Адрес записи в delegated routing. Параметр в конце — мимо кэша Cloudflare
 * перед delegated-ipfs.dev: кэш не различает Origin и отдаёт браузеру копию
 * без Access-Control-Allow-Origin, если первым имя спросил не браузер (её
 * отдавали ещё 3 минуты, 22.10.2026). Свежий ответ приходит с `*`.
 */
function recordUrl(name: string, fresh: boolean): string {
  const url = `${IPNS_ROUTER}/routing/v1/ipns/${name}`
  return fresh ? `${url}?t=${Date.now()}` : url
}

/** Подписанная запись имени из delegated routing; нет такой — null. */
export async function getRecordBytes(
  name: string,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  const res = await fetch(recordUrl(name, true), { headers: { Accept: RECORD_TYPE }, signal })
  // «Не найдено» delegated-ipfs.dev отдаёт кодом 200 и текстом, другие серверы — 404.
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`delegated routing GET ${res.status}`)
  if (!res.headers.get('content-type')?.startsWith(RECORD_TYPE)) return null
  return new Uint8Array(await res.arrayBuffer())
}

/** Запись имени в сети; нет её или она не проходит проверку — null. */
export async function fetchRecord(name: string, signal?: AbortSignal): Promise<NameRecord | null> {
  const bytes = await getRecordBytes(name, signal)
  if (!bytes) return null
  try {
    return await parseRecord(name, bytes)
  } catch {
    return null
  }
}

export async function putRecord(record: NameRecord, signal?: AbortSignal): Promise<void> {
  const res = await fetch(recordUrl(record.name, false), {
    method: 'PUT',
    headers: { 'Content-Type': RECORD_TYPE },
    body: record.bytes as Uint8Array<ArrayBuffer>,
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`delegated routing PUT ${res.status}: ${text.slice(0, 200)}`)
  }
}

/** Что приложение знает об имени: куда оно ведёт и номер последней записи. */
export interface KnownName {
  index: number
  value: string
  sequence: bigint
}

/**
 * Что отправить в сеть, чтобы имя жило дальше. Запись в сети новее нашей —
 * её значение главное: имя могли перевести с другого устройства. Свежая
 * запись переиздаётся как есть, у старой — новая подпись с тем же значением.
 * null — имени нет ни в сети, ни у нас.
 */
export async function renewal(
  key: Ed25519PrivateKey,
  known: KnownName | null,
  network: NameRecord | null,
  now = Date.now()
): Promise<NameRecord | null> {
  if (network && (!known || network.sequence >= known.sequence)) {
    if (network.validUntil.getTime() - now > RESIGN_BEFORE_MS) return network
    return signRecord(key, network.value, network.sequence + 1n, now)
  }
  if (!known) return null
  return signRecord(key, known.value, known.sequence + 1n, now)
}
