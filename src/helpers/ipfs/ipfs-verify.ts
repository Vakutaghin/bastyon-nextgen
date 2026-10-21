// Проверенное чтение файлов и папок UnixFS — для веба и телефона, где нет Rust.
// Близнец src-tauri/src/ipfs/verify.rs: те же правила, те же коды ошибок и те
// же фикстуры в тестах. Каждый блок сверяется с CID, по которому на него
// сослался родитель, поэтому подменить содержимое не может ни узел, приславший
// блок, ни библиотека, которая его скачала.
//
// Откуда блоки — решает BlockSource: в приложении это узел Helia
// (ipfs-node.ts), в тестах — блоки из фикстур.
import { CID } from 'multiformats/cid'
import { base16, base16upper } from 'multiformats/bases/base16'
import { base32, base32upper } from 'multiformats/bases/base32'
import { base36, base36upper } from 'multiformats/bases/base36'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { decode as decodePb, type PBNode } from '@ipld/dag-pb'
import { VerifyError } from './ipfs-errors'

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

/**
 * Сегменты пути ссылки (как в href, с %-кодированием) → имена в каталогах.
 * Отвергает то же, что SaveTarget::parse в Rust: `.`, `..`, слэши внутри
 * имени и управляющие символы.
 */
export function pathSegments(path: string): string[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((raw) => {
      let name: string
      try {
        name = decodeURIComponent(raw)
      } catch {
        throw new VerifyError('malformed', 'bad path')
      }
      // eslint-disable-next-line no-control-regex
      if (name === '.' || name === '..' || /[/\\\x00-\x1f\x7f]/.test(name)) {
        throw new VerifyError('malformed', 'bad path')
      }
      return name
    })
}

async function digestOf(code: number, bytes: Uint8Array): Promise<Uint8Array> {
  if (code === sha256.code) return (await sha256.digest(bytes)).bytes
  if (code === sha512.code) return (await sha512.digest(bytes)).bytes
  if (code === identity.code) return identity.digest(bytes).bytes
  throw new VerifyError('unsupported', `hash function 0x${code.toString(16)}`)
}

export async function verifyBlock(cid: CID, bytes: Uint8Array): Promise<void> {
  const digest = await digestOf(cid.multihash.code, bytes)
  if (!equals(digest, cid.multihash.bytes)) {
    throw new VerifyError('mismatch', `block ${cid.toString()} does not match its CID`)
  }
}

export interface BlockSource {
  /** Байты блока как пришли из сети. Проверяет их этот модуль, а не источник. */
  get(cid: CID): Promise<Uint8Array>
  /** Подсказка: эти блоки понадобятся следующими, по порядку. */
  prefetch?(cids: readonly CID[]): void
}

/**
 * Блоки для обхода: каждый сверяется с CID, по которому на него сослались.
 * identity-CID несёт данные в себе — в сеть за ним не ходим.
 */
class Blocks {
  private visits = 0

  constructor(private readonly source: BlockSource) {}

  async get(cid: CID): Promise<Uint8Array> {
    if (++this.visits > MAX_VISITS) throw new VerifyError('too-large')
    if (cid.multihash.code === identity.code) return cid.multihash.digest
    const bytes = await this.source.get(cid)
    await verifyBlock(cid, bytes)
    return bytes
  }

  prefetch(cids: readonly CID[]): void {
    const remote = cids.filter((c) => c.multihash.code !== identity.code)
    if (remote.length) this.source.prefetch?.(remote)
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
async function resolvePath(reader: Blocks, root: CID, segments: readonly string[]): Promise<CID> {
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
async function hamtFind(reader: Blocks, root: PBNode, rootFs: UnixFs, name: string): Promise<CID> {
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

/** Сколько блоков файла просить наперёд: по одному блоку за раз сеть отвечала бы медленно. */
const PREFETCH_BLOCKS = 12

export type Entity =
  | { kind: 'directory'; cid: CID }
  | {
      kind: 'file'
      cid: CID
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
  source: BlockSource,
  root: CID,
  segments: readonly string[],
  maxBytes: number
): Promise<Entity> {
  const reader = new Blocks(source)
  const cid = await resolvePath(reader, root, segments)
  const bytes = await reader.get(cid)
  if (cid.code === CODEC_RAW) {
    if (bytes.length > maxBytes) throw new VerifyError('too-large')
    return {
      kind: 'file',
      cid,
      size: bytes.length,
      chunks: fileChunks(reader, bytes, [], maxBytes),
    }
  }
  if (cid.code !== CODEC_DAG_PB) {
    throw new VerifyError('unsupported', `codec 0x${cid.code.toString(16)}`)
  }
  const { node, fs } = decodeDagPb(bytes)
  switch (fs.type) {
    case 'directory':
    case 'hamt-sharded-directory':
      return { kind: 'directory', cid }
    case 'file':
    case 'raw': {
      const size = unixfsFileSize(fs)
      if (size > maxBytes) throw new VerifyError('too-large')
      const links = node.Links.map((l) => l.Hash)
      return { kind: 'file', cid, size, chunks: fileChunks(reader, fs.data, links, maxBytes) }
    }
    case 'symlink':
      throw new VerifyError('unsupported', 'symlink')
    default:
      throw new VerifyError('malformed', `UnixFS type ${fs.type}`)
  }
}

/** Байты файла UnixFS по порядку: данные узла, затем его дети слева направо. */
async function* fileChunks(
  reader: Blocks,
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
  // Вершина стека — следующий блок по порядку файла.
  const stack = [...rootLinks].reverse()
  while (stack.length) {
    reader.prefetch(stack.slice(-PREFETCH_BLOCKS).reverse())
    const cid = stack.pop() as CID
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

export interface DirEntry {
  name: string
  cid: CID
  /** Размер из ссылки каталога: у файла это байты плюс немного служебных. */
  size: number
}

export interface DirListing {
  entries: DirEntry[]
  /** Записей больше, чем `limit`: показаны не все. */
  truncated: boolean
}

/**
 * Записи каталога: обычного или шардированного (HAMT). У HAMT записи лежат в
 * порядке хэшей имён — список сортируется по имени.
 */
export async function listDirectory(
  source: BlockSource,
  dir: CID,
  limit: number
): Promise<DirListing> {
  const reader = new Blocks(source)
  if (dir.code !== CODEC_DAG_PB) throw new VerifyError('malformed', 'not a directory')
  const { node, fs } = decodeDagPb(await reader.get(dir))
  const entries: DirEntry[] = []
  if (fs.type === 'directory') {
    for (const link of node.Links) {
      if (entries.length >= limit) return { entries, truncated: true }
      entries.push({ name: link.Name ?? '', cid: link.Hash, size: link.Tsize ?? 0 })
    }
    return { entries, truncated: false }
  }
  if (fs.type !== 'hamt-sharded-directory') throw new VerifyError('malformed', 'not a directory')
  const fanout = fs.fanout
  if (fanout === undefined || fanout < 2 || fanout > 4096 || (fanout & (fanout - 1)) !== 0) {
    throw new VerifyError('malformed', 'HAMT fanout')
  }
  const pad = (fanout - 1).toString(16).length
  const shards: PBNode[] = [node]
  for (let shard = shards.pop(); shard; shard = shards.pop()) {
    const subShards: CID[] = []
    for (const link of shard.Links) {
      const linkName = link.Name ?? ''
      if (linkName.length === pad) {
        subShards.push(link.Hash)
        continue
      }
      if (entries.length >= limit) return { entries: byName(entries), truncated: true }
      entries.push({ name: linkName.slice(pad), cid: link.Hash, size: link.Tsize ?? 0 })
    }
    reader.prefetch(subShards)
    for (const cid of subShards) {
      const child = decodeDagPb(await reader.get(cid))
      if (child.fs.type !== 'hamt-sharded-directory' || child.fs.fanout !== fanout) {
        throw new VerifyError('malformed', 'HAMT sub-shard')
      }
      shards.push(child.node)
    }
  }
  return { entries: byName(entries), truncated: false }
}

function byName(entries: DirEntry[]): DirEntry[] {
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export type EntryStat = { kind: 'directory' } | { kind: 'file'; size: number } | { kind: 'other' }

/** Что за запись каталога: для raw-листа хватает CID, иначе читается её корень. */
export async function statEntry(source: BlockSource, entry: DirEntry): Promise<EntryStat> {
  if (entry.cid.code === CODEC_RAW) return { kind: 'file', size: entry.size }
  if (entry.cid.code !== CODEC_DAG_PB) return { kind: 'other' }
  const { fs } = decodeDagPb(await new Blocks(source).get(entry.cid))
  if (fs.type === 'directory' || fs.type === 'hamt-sharded-directory') return { kind: 'directory' }
  if (fs.type === 'file' || fs.type === 'raw') return { kind: 'file', size: unixfsFileSize(fs) }
  return { kind: 'other' }
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
