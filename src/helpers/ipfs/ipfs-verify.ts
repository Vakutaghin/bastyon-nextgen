// Проверенное чтение файла UnixFS из CAR — для веба и телефона, где нет Rust.
// Близнец src-tauri/src/ipfs/verify.rs: те же правила, те же коды ошибок и те
// же фикстуры в тестах. Каждый блок сверяется с CID, по которому на него
// сослался родитель (метки CID внутри CAR не доверенные), поэтому подменить
// содержимое шлюз не может.
//
// Отличие от Rust: блоки не лежат на диске, а приходят потоком. Когда шлюз шлёт
// их в порядке обхода с повторами (order=dfs, dups=y), файл отдаётся кусками по
// мере прихода и память не растёт с размером файла. Блоки не по порядку и
// блоки, которые понадобятся повторно, копятся в буфере с потолком.
import { CID } from 'multiformats/cid'
import { base16, base16upper } from 'multiformats/bases/base16'
import { base32, base32upper } from 'multiformats/bases/base32'
import { base36, base36upper } from 'multiformats/bases/base36'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { decode as decodePb, type PBNode } from '@ipld/dag-pb'
import { TransportError, VerifyError, isAbortError } from './ipfs-errors'

const CODEC_DAG_PB = 0x70
const CODEC_RAW = 0x55
/** murmur3-x64-64: единственная хэш-функция HAMT в UnixFS. */
const HASH_MURMUR3_X64_64 = 0x22
/** Потолок числа посещённых блоков: DAG из миллионов пустых узлов не даёт данных, но крутит цикл. */
const MAX_VISITS = 10_000_000

const MULTIBASE = base32.decoder
  .or(base32upper.decoder)
  .or(base36.decoder)
  .or(base36upper.decoder)
  .or(base58btc.decoder)
  .or(base16.decoder)
  .or(base16upper.decoder)

/** CID из ссылки: CIDv0 (`Qm…`) и CIDv1 в base32/base36/base58btc/base16. */
export function parseCid(text: string): CID {
  try {
    return CID.parse(text, MULTIBASE)
  } catch {
    throw new VerifyError('malformed', `invalid CID ${text.slice(0, 64)}`)
  }
}

async function digestOf(code: number, bytes: Uint8Array): Promise<Uint8Array> {
  if (code === sha256.code) return (await sha256.digest(bytes)).bytes
  if (code === sha512.code) return (await sha512.digest(bytes)).bytes
  if (code === identity.code) return identity.digest(bytes).bytes
  throw new VerifyError('unsupported', `hash function 0x${code.toString(16)}`)
}

async function verifyBlock(cid: CID, bytes: Uint8Array): Promise<void> {
  const digest = await digestOf(cid.multihash.code, bytes)
  if (!equals(digest, cid.multihash.bytes)) {
    throw new VerifyError('mismatch', `block ${cid.toString()} does not match its CID`)
  }
}

function hex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export interface CarBlock {
  cid: CID
  bytes: Uint8Array
}

export interface BlockReaderOptions {
  /** Хранить выданные блоки: без dups=y повторный блок файла второй раз не придёт. */
  keepConsumed: boolean
  /** Потолок байт, которые держим в памяти: пришедшие раньше очереди и оставленные для повтора. */
  maxBuffered: number
}

/**
 * Блоки по CID из потока CAR. Блок ищется по multihash, а проверяется по
 * CID, через который на него сослались, — не по метке в CAR.
 */
export class BlockReader {
  private readonly early = new Map<string, Uint8Array>()
  private readonly kept = new Map<string, Uint8Array>()
  private buffered = 0
  private visits = 0

  constructor(
    private readonly blocks: AsyncIterator<CarBlock>,
    private readonly opts: BlockReaderOptions
  ) {}

  /** Сколько байт сейчас лежит в буфере (для тестов потокового режима). */
  get bufferedBytes(): number {
    return this.buffered
  }

  async get(cid: CID): Promise<Uint8Array> {
    if (++this.visits > MAX_VISITS) throw new VerifyError('too-large')
    // identity: данные лежат прямо в CID, в CAR такого блока нет.
    if (cid.multihash.code === identity.code) return cid.multihash.digest
    const key = hex(cid.multihash.bytes)
    const bytes = this.take(key) ?? (await this.pull(key, cid))
    await verifyBlock(cid, bytes)
    if (this.opts.keepConsumed && !this.kept.has(key)) this.hold(this.kept, key, bytes)
    return bytes
  }

  private take(key: string): Uint8Array | undefined {
    const kept = this.kept.get(key)
    if (kept) return kept
    const early = this.early.get(key)
    if (early) {
      this.early.delete(key)
      this.buffered -= early.length
    }
    return early
  }

  private async pull(key: string, cid: CID): Promise<Uint8Array> {
    for (;;) {
      let next: IteratorResult<CarBlock>
      try {
        next = await this.blocks.next()
      } catch (e) {
        if (e instanceof VerifyError || e instanceof TransportError || isAbortError(e)) throw e
        // CAR оборвался или испорчен на середине.
        throw new VerifyError(
          'missing',
          `the gateway response broke off before block ${cid.toString()}`
        )
      }
      if (next.done) {
        throw new VerifyError('missing', `the gateway did not send block ${cid.toString()}`)
      }
      const k = hex(next.value.cid.multihash.bytes)
      if (k === key) return next.value.bytes
      if (!this.early.has(k) && !this.kept.has(k)) this.hold(this.early, k, next.value.bytes)
    }
  }

  private hold(map: Map<string, Uint8Array>, key: string, bytes: Uint8Array): void {
    this.buffered += bytes.length
    if (this.buffered > this.opts.maxBuffered) {
      throw new VerifyError('too-large', 'too many blocks held in memory')
    }
    map.set(key, bytes)
  }
}

type UnixFsType = 'raw' | 'directory' | 'file' | 'metadata' | 'symlink' | 'hamt-sharded-directory'

const UNIXFS_TYPES: readonly UnixFsType[] = [
  'raw',
  'directory',
  'file',
  'metadata',
  'symlink',
  'hamt-sharded-directory',
]

interface UnixFs {
  type: UnixFsType
  data?: Uint8Array
  fileSize?: number
  blockSizes: number[]
  hashType?: number
  fanout?: number
}

/** Беззнаковый varint protobuf: [значение, позиция после него]. */
function readVarint(b: Uint8Array, pos: number): [number, number] {
  let value = 0
  let scale = 1
  for (let i = 0; i < 10; i++) {
    const byte = b[pos + i]
    if (byte === undefined) throw new VerifyError('malformed', 'truncated varint')
    value += (byte & 0x7f) * scale
    if (byte < 0x80) {
      if (value > Number.MAX_SAFE_INTEGER) throw new VerifyError('malformed', 'varint too large')
      return [value, pos + i + 1]
    }
    scale *= 128
  }
  throw new VerifyError('malformed', 'varint too long')
}

/**
 * Данные UnixFS (protobuf) из узла dag-pb. Разбираем сами, как verify.rs:
 * ipfs-unixfs 13 при разборе теряет hashType, а без него HAMT не проверить.
 */
function decodeUnixfs(bytes: Uint8Array): UnixFs {
  let kind: number | undefined
  const fs: Omit<UnixFs, 'type'> = { blockSizes: [] }
  let pos = 0
  while (pos < bytes.length) {
    const [key, afterKey] = readVarint(bytes, pos)
    pos = afterKey
    const field = Math.floor(key / 8)
    const wire = key % 8
    if (wire === 0) {
      const [value, next] = readVarint(bytes, pos)
      pos = next
      if (field === 1) kind = value
      else if (field === 3) fs.fileSize = value
      else if (field === 4) fs.blockSizes.push(value)
      else if (field === 5) fs.hashType = value
      else if (field === 6) fs.fanout = value
    } else if (wire === 2) {
      const [len, start] = readVarint(bytes, pos)
      pos = start + len
      if (pos > bytes.length) throw new VerifyError('malformed', 'UnixFS field overflows')
      const value = bytes.subarray(start, pos)
      if (field === 2) fs.data = value
      else if (field === 4) {
        // blocksizes в упакованном виде.
        for (let p = 0; p < value.length; ) {
          const [size, next] = readVarint(value, p)
          fs.blockSizes.push(size)
          p = next
        }
      }
    } else if (wire === 1 || wire === 5) {
      pos += wire === 1 ? 8 : 4
      if (pos > bytes.length) throw new VerifyError('malformed', 'UnixFS field overflows')
    } else {
      throw new VerifyError('malformed', `UnixFS wire type ${wire}`)
    }
  }
  const type = kind === undefined ? undefined : UNIXFS_TYPES[kind]
  if (!type) throw new VerifyError('malformed', 'UnixFS type')
  return { type, ...fs }
}

/** Размер файла по корню: поле filesize, а без него — данные узла и размеры детей. */
function unixfsFileSize(fs: UnixFs): number {
  if (fs.fileSize !== undefined) return fs.fileSize
  return fs.blockSizes.reduce((sum, n) => sum + n, fs.data?.length ?? 0)
}

function decodeDagPb(bytes: Uint8Array): { node: PBNode; fs: UnixFs } {
  let node: PBNode
  try {
    node = decodePb(bytes)
  } catch {
    throw new VerifyError('malformed', 'dag-pb')
  }
  if (!node.Data) throw new VerifyError('malformed', 'dag-pb node without UnixFS data')
  return { node, fs: decodeUnixfs(node.Data) }
}

/** CID по пути от корня: обычные каталоги и шардированные (HAMT). */
async function resolvePath(
  reader: BlockReader,
  root: CID,
  segments: readonly string[]
): Promise<CID> {
  let cur = root
  for (const name of segments) {
    if (cur.code !== CODEC_DAG_PB) throw new VerifyError('not-found', name)
    const { node, fs } = decodeDagPb(await reader.get(cur))
    if (fs.type === 'directory') {
      const link = node.Links.find((l) => l.Name === name)
      if (!link) throw new VerifyError('not-found', name)
      cur = link.Hash
    } else if (fs.type === 'hamt-sharded-directory') {
      cur = await hamtFind(reader, node, fs, name)
    } else {
      throw new VerifyError('not-found', name)
    }
  }
  return cur
}

const MASK64 = (1n << 64n) - 1n

/**
 * Поиск имени в HAMT-каталоге UnixFS: murmur3 от имени режется на куски по
 * log2(fanout) бит, старшие первыми; каждый кусок — номер слота на своём
 * уровне. Ссылка слота называется HEX-номером (`0A`) — это вложенный шард, или
 * номером с именем (`0Af10.txt`) — это сама запись.
 */
async function hamtFind(
  reader: BlockReader,
  root: PBNode,
  rootFs: UnixFs,
  name: string
): Promise<CID> {
  if (rootFs.hashType !== HASH_MURMUR3_X64_64) {
    throw new VerifyError('unsupported', 'HAMT hash function')
  }
  const fanout = rootFs.fanout
  if (fanout === undefined) throw new VerifyError('malformed', 'HAMT without fanout')
  if (fanout < 2 || fanout > 4096 || (fanout & (fanout - 1)) !== 0) {
    throw new VerifyError('malformed', 'HAMT fanout')
  }
  const bits = BigInt(Math.log2(fanout))
  const pad = (fanout - 1).toString(16).length
  const hash = murmur3x64_64(new TextEncoder().encode(name))

  let node = root
  let consumed = 0n
  for (;;) {
    if (consumed + bits > 64n) throw new VerifyError('not-found', name)
    const slot = ((hash << consumed) & MASK64) >> (64n - bits)
    consumed += bits
    const prefix = slot.toString(16).toUpperCase().padStart(pad, '0')
    const link = node.Links.find((l) => (l.Name ?? '').startsWith(prefix))
    if (!link) throw new VerifyError('not-found', name)
    const linkName = link.Name ?? ''
    if (linkName.length === pad) {
      const child = decodeDagPb(await reader.get(link.Hash))
      if (child.fs.type !== 'hamt-sharded-directory' || child.fs.fanout !== fanout) {
        throw new VerifyError('malformed', 'HAMT sub-shard')
      }
      node = child.node
      continue
    }
    if (linkName.slice(pad) === name) return link.Hash
    throw new VerifyError('not-found', name)
  }
}

export type Entity =
  | { kind: 'directory' }
  | {
      kind: 'file'
      /** Размер из корня файла (проверенного); фактические байты тоже ограничены. */
      size: number
      /** Байты файла по порядку, каждый кусок уже проверен. */
      chunks: AsyncGenerator<Uint8Array, void, undefined>
    }

/**
 * Что лежит по пути: каталог или файл. Корень файла читается сразу — отсюда
 * размер (и ранний отказ по потолку), остальное читает `chunks` по мере
 * потребления.
 */
export async function openEntity(
  reader: BlockReader,
  root: CID,
  segments: readonly string[],
  maxBytes: number
): Promise<Entity> {
  const cid = await resolvePath(reader, root, segments)
  const bytes = await reader.get(cid)
  if (cid.code === CODEC_RAW) {
    if (bytes.length > maxBytes) throw new VerifyError('too-large')
    return { kind: 'file', size: bytes.length, chunks: fileChunks(reader, bytes, [], maxBytes) }
  }
  if (cid.code !== CODEC_DAG_PB) {
    throw new VerifyError('unsupported', `codec 0x${cid.code.toString(16)}`)
  }
  const { node, fs } = decodeDagPb(bytes)
  switch (fs.type) {
    case 'directory':
    case 'hamt-sharded-directory':
      return { kind: 'directory' }
    case 'file':
    case 'raw': {
      const size = unixfsFileSize(fs)
      if (size > maxBytes) throw new VerifyError('too-large')
      const links = node.Links.map((l) => l.Hash)
      return { kind: 'file', size, chunks: fileChunks(reader, fs.data, links, maxBytes) }
    }
    case 'symlink':
      throw new VerifyError('unsupported', 'symlink')
    default:
      throw new VerifyError('malformed', `UnixFS type ${fs.type}`)
  }
}

/** Байты файла UnixFS по порядку: данные узла, затем его дети слева направо. */
async function* fileChunks(
  reader: BlockReader,
  rootData: Uint8Array | undefined,
  rootLinks: CID[],
  maxBytes: number
): AsyncGenerator<Uint8Array, void, undefined> {
  let total = 0
  const counted = (data: Uint8Array): Uint8Array => {
    total += data.length
    if (total > maxBytes) throw new VerifyError('too-large')
    return data
  }
  if (rootData?.length) yield counted(rootData)
  const stack = [...rootLinks].reverse()
  for (let cid = stack.pop(); cid; cid = stack.pop()) {
    const bytes = await reader.get(cid)
    let data: Uint8Array | undefined
    if (cid.code === CODEC_RAW) {
      data = bytes
    } else if (cid.code === CODEC_DAG_PB) {
      const { node, fs } = decodeDagPb(bytes)
      if (fs.type === 'directory' || fs.type === 'hamt-sharded-directory') {
        throw new VerifyError('directory')
      }
      if (fs.type === 'symlink') throw new VerifyError('unsupported', 'symlink')
      if (fs.type !== 'file' && fs.type !== 'raw') {
        throw new VerifyError('malformed', `UnixFS type ${fs.type}`)
      }
      data = fs.data
      stack.push(...node.Links.map((l) => l.Hash).reverse())
    } else {
      throw new VerifyError('unsupported', `codec 0x${cid.code.toString(16)}`)
    }
    if (data?.length) yield counted(data)
  }
}

// ---------------------------------------------------------------------------
// murmur3
// ---------------------------------------------------------------------------

const C1 = 0x87c37b91114253d5n
const C2 = 0x4cf5ad432745937fn

const mul = (a: bigint, b: bigint): bigint => (a * b) & MASK64
const add = (a: bigint, b: bigint): bigint => (a + b) & MASK64
const rotl = (x: bigint, r: bigint): bigint => ((x << r) | (x >> (64n - r))) & MASK64

function fmix64(k: bigint): bigint {
  k ^= k >> 33n
  k = mul(k, 0xff51afd7ed558ccdn)
  k ^= k >> 33n
  k = mul(k, 0xc4ceb9fe1a85ec53n)
  return k ^ (k >> 33n)
}

/** MurmurHash3_x64_128 (h1, h2) — перенос из verify.rs. */
export function murmur3x64_128(data: Uint8Array, seed = 0n): [bigint, bigint] {
  let h1 = seed
  let h2 = seed
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const blocks = Math.floor(data.length / 16)
  for (let i = 0; i < blocks; i++) {
    let k1 = view.getBigUint64(i * 16, true)
    let k2 = view.getBigUint64(i * 16 + 8, true)
    k1 = mul(rotl(mul(k1, C1), 31n), C2)
    h1 ^= k1
    h1 = add(mul(add(rotl(h1, 27n), h2), 5n), 0x52dce729n)
    k2 = mul(rotl(mul(k2, C2), 33n), C1)
    h2 ^= k2
    h2 = add(mul(add(rotl(h2, 31n), h1), 5n), 0x38495ab5n)
  }
  const tail = data.subarray(blocks * 16)
  let k1 = 0n
  let k2 = 0n
  tail.forEach((byte, i) => {
    if (i < 8) k1 ^= BigInt(byte) << BigInt(8 * i)
    else k2 ^= BigInt(byte) << BigInt(8 * (i - 8))
  })
  if (tail.length > 8) h2 ^= mul(rotl(mul(k2, C2), 33n), C1)
  if (tail.length > 0) h1 ^= mul(rotl(mul(k1, C1), 31n), C2)
  const len = BigInt(data.length)
  h1 ^= len
  h2 ^= len
  h1 = add(h1, h2)
  h2 = add(h2, h1)
  h1 = fmix64(h1)
  h2 = fmix64(h2)
  h1 = add(h1, h2)
  h2 = add(h2, h1)
  return [h1, h2]
}

/** Первые 64 бита MurmurHash3_x64_128 с seed 0 — ими адресуются слоты HAMT. */
export function murmur3x64_64(data: Uint8Array): bigint {
  return murmur3x64_128(data)[0]
}
