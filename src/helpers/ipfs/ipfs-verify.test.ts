// Те же сценарии, что в src-tauri/src/ipfs/verify.rs, на тех же фикстурах:
// testdata/*.car сняты Kubo v0.43.0 скриптом make-fixtures.sh (CID — в cids.env).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CarBlockIterator } from '@ipld/car/iterator'
import type { CID } from 'multiformats/cid'
import { VerifyError, type VerifyCode } from './ipfs-errors'
import {
  listDirectory,
  murmur3x64_128,
  murmur3x64_64,
  openEntity,
  parseCid,
  pathSegments,
  statEntry,
  type BlockSource,
} from './ipfs-verify'

const SMALL_V0 = 'QmWmkE7shY3Z4JnHqMYqvzLvsAR5ZYhkHSuskPXSCdHKSF'
const CHUNKED_V0 = 'QmYdDbAGaTRc5KgQhznmX9F5mEfzyFrdzcPZrEukdrXvbd'
const DEEP_V1 = 'bafybeib6r2qk4qrwf3f4otzo5qiyac7mfoqq2m4oyfy5ml6icssb52dul4'
const SITE_V1 = 'bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e'
const INLINE_V1 = 'bafyaagascifaoakvaabwq2ikcicwcltupb2bqaykaieac'
const SHA512_V1 =
  'bafkrgqaxh7dctookfe4ftocaedcpc2gb77xactevfeqjfiqvaf7fnv2qjqqmeb62xmak5pbapfby5x3wxqkjxufpmvibk7pjkaohqbo5sx2rw'
const BLAKE3_V1 = 'bafkr4igxau6eosyvmifupkb4u37mmsht6am7gtu44a4pyie3wd5nzc64hu'
const HAMT_V1 = 'bafybeiebhxtf6cz7c2cxa74wbun33b2jybubkgqrtsbqlpa7w4sjrdpqma'

const text = (s: string): Uint8Array => new TextEncoder().encode(s)

/** Содержимое сгенерированных файлов — как `pattern` в make-fixtures.sh. */
function pattern(n: number): Uint8Array {
  return Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)
}

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'src-tauri/src/ipfs/testdata', name)))
}

/**
 * Блоки фикстуры по multihash — как их прислал бы узел сети, без проверки:
 * проверяет обход. Запоминает, какие блоки просили и о каких предупредили.
 */
class FixtureSource implements BlockSource {
  readonly blocks = new Map<string, Uint8Array>()
  readonly requested: string[] = []
  readonly prefetched: string[][] = []

  static async of(car: Uint8Array): Promise<FixtureSource> {
    const source = new FixtureSource()
    for await (const block of await CarBlockIterator.fromBytes(car)) {
      source.blocks.set(block.cid.multihash.bytes.join(','), block.bytes)
    }
    return source
  }

  async get(cid: CID): Promise<Uint8Array> {
    this.requested.push(cid.toString())
    const bytes = this.blocks.get(cid.multihash.bytes.join(','))
    if (!bytes) throw new VerifyError('missing', cid.toString())
    return bytes
  }

  prefetch(cids: readonly CID[]): void {
    this.prefetched.push(cids.map(String))
  }

  /** Подменить блок `cid` байтами другого блока. */
  swap(cid: string, bytes: Uint8Array): void {
    this.blocks.set(parseCid(cid).multihash.bytes.join(','), bytes)
  }
}

async function readAll(source: BlockSource, root: string, path: string[], maxBytes: number) {
  const entity = await openEntity(source, parseCid(root), path, maxBytes)
  if (entity.kind === 'directory') throw new VerifyError('directory')
  const parts: Uint8Array[] = []
  for await (const chunk of entity.chunks) parts.push(chunk)
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function extract(car: Uint8Array, root: string, path: string[] = [], maxBytes?: number) {
  return readAll(await FixtureSource.of(car), root, path, maxBytes ?? Number.MAX_SAFE_INTEGER)
}

async function failure(promise: Promise<unknown>): Promise<VerifyCode> {
  try {
    await promise
  } catch (e) {
    if (e instanceof VerifyError) return e.code
    throw e
  }
  throw new Error('expected a VerifyError')
}

describe('CID', () => {
  it('один CID разбирается из любой поддерживаемой multibase', () => {
    const v0 = parseCid(SMALL_V0)
    for (const s of [
      'bafybeid5jnarnbmxfdidpcgqdsxu5jz5dtmqcjkt2k43wcmbvul5prf4ea',
      'BAFYBEID5JNARNBMXFDIDPCGQDSXU5JZ5DTMQCJKT2K43WCMBVUL5PRF4EA',
      'k2jmtxuhj5f39u2z4xn2ic1y13n5gfntzemkxymxbg3xc5opph03esrk',
      'zdj7WdrzbYwZ1X9w26Da6WToNBVVNcXH67t9mKQRBv724rDcB',
      'f017012207d4b4116859728d03788d01caf4ea73d1cd9012553d2b9bb0981ad17d7c4bc20',
    ]) {
      expect(parseCid(s).equals(v0.toV1()), s).toBe(true)
    }
    expect(v0.code).toBe(0x70)
    expect(v0.multihash.code).toBe(0x12)
  })

  it('мусор вместо CID отвергается', () => {
    for (const s of ['', 'bafy!!!', 'xabc', 'Qm11111111111111111111111111111111111111111111']) {
      expect(() => parseCid(s), s).toThrow(VerifyError)
    }
  })
})

describe('путь из ссылки', () => {
  it('раскодируется, опасные сегменты отвергаются', () => {
    expect(pathSegments('docs/my%20file.pdf')).toEqual(['docs', 'my file.pdf'])
    expect(pathSegments('')).toEqual([])
    for (const bad of ['a/%2e%2e', 'a%2Fb', 'a%5Cb', 'x%0Ay', '%E0%A4%A']) {
      expect(() => pathSegments(bad), bad).toThrow(VerifyError)
    }
  })
})

describe('murmur3', () => {
  it('совпадает с эталоном (как go murmur3.Sum64)', () => {
    expect(murmur3x64_128(new Uint8Array())).toEqual([0n, 0n])
    expect(murmur3x64_64(text('hello'))).toBe(0xcbd8a7b341bd9b02n)
  })
})

describe('чтение файла', () => {
  it('CIDv0: файл в одном узле и файл из dag-pb-листьев', async () => {
    expect(await extract(fixture('small-v0.car'), SMALL_V0)).toEqual(text('hello bastyon\n'))
    expect(await extract(fixture('chunked-v0.car'), CHUNKED_V0)).toEqual(pattern(1000))
  })

  it('глубокое дерево с raw-листьями', async () => {
    expect(await extract(fixture('deep-v1.car'), DEEP_V1)).toEqual(pattern(6000))
  })

  it('путь через каталоги', async () => {
    const car = fixture('site-v1.car')
    expect(await extract(car, SITE_V1, ['index.html'])).toEqual(text('<h1>hi</h1>\n'))
    expect(await extract(car, SITE_V1, ['assets', 'app.js'])).toEqual(pattern(3000))
    expect(await failure(extract(car, SITE_V1))).toBe('directory')
    expect(await failure(extract(car, SITE_V1, ['assets']))).toBe('directory')
    expect(await failure(extract(car, SITE_V1, ['nope.js']))).toBe('not-found')
    // Путь «сквозь» файл.
    expect(await failure(extract(car, SITE_V1, ['index.html', 'x']))).toBe('not-found')
  })

  it('каждая запись шардированного каталога находится', async () => {
    const source = await FixtureSource.of(fixture('hamt-v1.car'))
    for (let i = 0; i < 300; i++) {
      const name = `f${i}.txt`
      expect(await readAll(source, HAMT_V1, [name], 1 << 20), name).toEqual(text(`entry ${i}\n`))
    }
    expect(await failure(readAll(source, HAMT_V1, ['f300.txt'], 1 << 20))).toBe('not-found')
  })

  it('identity- и sha2-512-CID проверяются тоже', async () => {
    // Каталог и файл целиком внутри CID: в сеть за ними не ходят.
    expect(await extract(fixture('inline-v1.car'), INLINE_V1, ['a.txt'])).toEqual(text('hi\n'))
    expect(await extract(fixture('sha512-v1.car'), SHA512_V1)).toEqual(text('hello bastyon\n'))
  })

  it('непроверяемый хэш отвергается, а не принимается на веру', async () => {
    expect(await failure(extract(fixture('blake3-v1.car'), BLAKE3_V1))).toBe('unsupported')
  })
})

describe('чужие данные из сети', () => {
  it('испорченный блок', async () => {
    const source = await FixtureSource.of(fixture('deep-v1.car'))
    const [leaf] = [...source.blocks.entries()].filter(([, b]) => b.length > 0).slice(-1)
    const bytes = (leaf as [string, Uint8Array])[1].slice()
    bytes[Math.floor(bytes.length / 2)] = (bytes[Math.floor(bytes.length / 2)] as number) ^ 0x01
    source.blocks.set((leaf as [string, Uint8Array])[0], bytes)
    expect(await failure(readAll(source, DEEP_V1, [], Number.MAX_SAFE_INTEGER))).toBe('mismatch')
  })

  it('вместо корня прислали другой, целый блок', async () => {
    const source = await FixtureSource.of(fixture('chunked-v0.car'))
    const small = await FixtureSource.of(fixture('small-v0.car'))
    source.swap(CHUNKED_V0, await small.get(parseCid(SMALL_V0)))
    expect(await failure(readAll(source, CHUNKED_V0, [], 1 << 20))).toBe('mismatch')
  })

  it('потолок размера: отказ по размеру из корня, до скачивания данных', async () => {
    const source = await FixtureSource.of(fixture('deep-v1.car'))
    expect(await failure(readAll(source, DEEP_V1, [], 1000))).toBe('too-large')
    expect(source.requested).toEqual([DEEP_V1])
    expect(await failure(extract(fixture('small-v0.car'), SMALL_V0, [], 5))).toBe('too-large')
  })
})

describe('чтение наперёд', () => {
  it('следующие блоки файла запрашиваются заранее, по порядку и не больше 12', async () => {
    const source = await FixtureSource.of(fixture('deep-v1.car'))
    expect(await readAll(source, DEEP_V1, [], Number.MAX_SAFE_INTEGER)).toEqual(pattern(6000))
    expect(source.prefetched.length).toBeGreaterThan(0)
    for (const batch of source.prefetched) expect(batch.length).toBeLessThanOrEqual(12)
    // Первым в каждой подсказке — блок, который обход тут же попросит.
    const asked = source.requested.slice(1)
    source.prefetched.forEach((batch, i) => expect(batch[0]).toBe(asked[i]))
  })
})

describe('каталог', () => {
  it('обычный: записи с CID и размером из ссылок', async () => {
    const source = await FixtureSource.of(fixture('site-v1.car'))
    const { entries, truncated } = await listDirectory(source, parseCid(SITE_V1), 100)
    expect(truncated).toBe(false)
    expect(entries.map((e) => e.name)).toEqual(['assets', 'index.html'])
    const stats = await Promise.all(entries.map((e) => statEntry(source, e)))
    expect(stats).toEqual([{ kind: 'directory' }, { kind: 'file', size: 12 }])
  })

  it('открытие пути на каталог отдаёт его CID', async () => {
    const source = await FixtureSource.of(fixture('site-v1.car'))
    const entity = await openEntity(source, parseCid(SITE_V1), ['assets'], 1 << 20)
    expect(entity.kind).toBe('directory')
    const { entries } = await listDirectory(source, entity.cid, 100)
    expect(entries.map((e) => e.name)).toEqual(['app.js'])
  })

  it('шардированный: все записи по имени, потолок числа записей', async () => {
    const source = await FixtureSource.of(fixture('hamt-v1.car'))
    const all = await listDirectory(source, parseCid(HAMT_V1), 1000)
    expect(all.truncated).toBe(false)
    expect(all.entries).toHaveLength(300)
    const names = all.entries.map((e) => e.name)
    expect(names).toEqual([...names].sort())
    expect(new Set(names)).toEqual(new Set(Array.from({ length: 300 }, (_, i) => `f${i}.txt`)))
    const some = await listDirectory(source, parseCid(HAMT_V1), 10)
    expect(some.truncated).toBe(true)
    expect(some.entries).toHaveLength(10)
  })

  it('файл — не каталог', async () => {
    const source = await FixtureSource.of(fixture('chunked-v0.car'))
    expect(await failure(listDirectory(source, parseCid(CHUNKED_V0), 10))).toBe('malformed')
  })
})
