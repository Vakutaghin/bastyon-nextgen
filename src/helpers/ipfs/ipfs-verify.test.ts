// Те же сценарии, что в src-tauri/src/ipfs/verify.rs, на тех же фикстурах:
// testdata/*.car сняты Kubo v0.43.0 скриптом make-fixtures.sh (CID — в cids.env).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CarBlockIterator } from '@ipld/car/iterator'
import { decode as decodePb } from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { varint } from 'multiformats'
import { VerifyError, type VerifyCode } from './ipfs-errors'
import { BlockReader, murmur3x64_128, murmur3x64_64, openEntity, parseCid } from './ipfs-verify'

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

type ReadOpts = { keepConsumed?: boolean; maxBuffered?: number; maxBytes?: number }

async function readerFor(car: Uint8Array, opts: ReadOpts = {}): Promise<BlockReader> {
  const blocks = await CarBlockIterator.fromBytes(car)
  return new BlockReader(blocks[Symbol.asyncIterator](), {
    keepConsumed: opts.keepConsumed ?? true,
    maxBuffered: opts.maxBuffered ?? Number.MAX_SAFE_INTEGER,
  })
}

async function readAll(reader: BlockReader, root: string, path: string[], maxBytes: number) {
  const entity = await openEntity(reader, parseCid(root), path, maxBytes)
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

async function extract(car: Uint8Array, root: string, path: string[] = [], opts: ReadOpts = {}) {
  return readAll(await readerFor(car, opts), root, path, opts.maxBytes ?? Number.MAX_SAFE_INTEGER)
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

/** Смещения секций CAR: [начало секции, начало данных блока, конец]. */
function sections(car: Uint8Array): Array<[number, number, number]> {
  const [headerLen, n] = varint.decode(car)
  let pos = n + headerLen
  const out: Array<[number, number, number]> = []
  while (pos < car.length) {
    const start = pos
    const [len, used] = varint.decode(car, pos)
    pos += used
    const [cid] = CID.decodeFirst(car.subarray(pos))
    out.push([start, pos + cid.bytes.length, pos + len])
    pos += len
  }
  return out
}

/**
 * CAR файла в порядке обхода с повторами — так отвечает шлюз на
 * `order=dfs, dups=y`. Блоки берутся из фикстуры (там каждый блок один раз).
 */
async function dfsWithDups(car: Uint8Array, root: string): Promise<Uint8Array> {
  const byHash = new Map<string, { cid: CID; bytes: Uint8Array }>()
  for await (const block of await CarBlockIterator.fromBytes(car)) {
    byHash.set(block.cid.multihash.bytes.join(','), block)
  }
  const [headerLen, n] = varint.decode(car)
  const parts: Uint8Array[] = [car.subarray(0, n + headerLen)]
  const walk = (cid: CID): void => {
    const block = byHash.get(cid.multihash.bytes.join(','))
    if (!block) throw new Error(`fixture lacks ${cid}`)
    const body = new Uint8Array([...block.cid.bytes, ...block.bytes])
    parts.push(
      Uint8Array.from(
        varint.encodeTo(body.length, new Uint8Array(varint.encodingLength(body.length)))
      ),
      body
    )
    if (cid.code === 0x70) decodePb(block.bytes).Links.forEach((l) => walk(l.Hash))
  }
  walk(parseCid(root))
  return new Uint8Array(parts.flatMap((p) => [...p]))
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

describe('murmur3', () => {
  it('совпадает с эталоном (как go murmur3.Sum64)', () => {
    expect(murmur3x64_128(new Uint8Array())).toEqual([0n, 0n])
    expect(murmur3x64_64(text('hello'))).toBe(0xcbd8a7b341bd9b02n)
  })
})

describe('чтение файла из CAR', () => {
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
    const reader = await readerFor(fixture('hamt-v1.car'))
    for (let i = 0; i < 300; i++) {
      const name = `f${i}.txt`
      expect(await readAll(reader, HAMT_V1, [name], 1 << 20), name).toEqual(text(`entry ${i}\n`))
    }
    expect(await failure(readAll(reader, HAMT_V1, ['f300.txt'], 1 << 20))).toBe('not-found')
  })

  it('identity- и sha2-512-CID проверяются тоже', async () => {
    // Каталог и файл целиком внутри CID: в CAR блоков нет вовсе.
    expect(await extract(fixture('inline-v1.car'), INLINE_V1, ['a.txt'])).toEqual(text('hi\n'))
    expect(await extract(fixture('sha512-v1.car'), SHA512_V1)).toEqual(text('hello bastyon\n'))
  })

  it('непроверяемый хэш отвергается, а не принимается на веру', async () => {
    expect(await failure(extract(fixture('blake3-v1.car'), BLAKE3_V1))).toBe('unsupported')
  })
})

describe('чужие данные от шлюза', () => {
  it('испорченный блок', async () => {
    const car = fixture('deep-v1.car')
    // Портим байт в данных последнего блока (листа файла).
    const all = sections(car)
    const [, dataStart, end] = all[all.length - 1] as [number, number, number]
    const index = Math.floor((dataStart + end) / 2)
    car[index] = (car[index] as number) ^ 0x01
    expect(await failure(extract(car, DEEP_V1))).toBe('mismatch')
  })

  it('чужой, но корректный CAR: корня из ссылки в нём нет', async () => {
    expect(await failure(extract(fixture('small-v0.car'), CHUNKED_V0))).toBe('missing')
  })

  it('недостающий блок', async () => {
    const car = fixture('deep-v1.car')
    const all = sections(car)
    const [start] = all[all.length - 1] as [number, number, number]
    expect(await failure(extract(car.subarray(0, start), DEEP_V1))).toBe('missing')
  })

  it('повторы блоков не мешают', async () => {
    const car = fixture('chunked-v0.car')
    const [start, , end] = sections(car)[1] as [number, number, number]
    const dup = new Uint8Array([...car, ...car.subarray(start, end)])
    expect(await extract(dup, CHUNKED_V0)).toEqual(pattern(1000))
  })

  it('потолок размера: отказ по размеру из корня, до скачивания данных', async () => {
    expect(await failure(extract(fixture('deep-v1.car'), DEEP_V1, [], { maxBytes: 1000 }))).toBe(
      'too-large'
    )
    expect(await failure(extract(fixture('small-v0.car'), SMALL_V0, [], { maxBytes: 5 }))).toBe(
      'too-large'
    )
  })
})

describe('поток в порядке обхода (order=dfs, dups=y)', () => {
  it('файл собирается без буфера: блоки не копятся в памяти', async () => {
    for (const [name, root, expected] of [
      ['chunked-v0.car', CHUNKED_V0, pattern(1000)],
      ['deep-v1.car', DEEP_V1, pattern(6000)],
    ] as const) {
      const car = await dfsWithDups(fixture(name), root)
      const reader = await readerFor(car, { keepConsumed: false, maxBuffered: 0 })
      expect(await readAll(reader, root, [], Number.MAX_SAFE_INTEGER), name).toEqual(expected)
      expect(reader.bufferedBytes).toBe(0)
    }
  })

  it('без повторов тот же файл требует буфера (dups=n)', async () => {
    // В chunked-v0 куски повторяются (период узора 256 байт): без повторов в
    // потоке уже выданный блок нужен снова — его приходится хранить.
    const car = fixture('chunked-v0.car')
    const noKeep = { keepConsumed: false, maxBuffered: Number.MAX_SAFE_INTEGER }
    expect(await failure(extract(car, CHUNKED_V0, [], noKeep))).toBe('missing')
    expect(await extract(car, CHUNKED_V0, [], { keepConsumed: true })).toEqual(pattern(1000))
  })

  it('блоки не по порядку упираются в потолок буфера', async () => {
    const reader = await readerFor(fixture('hamt-v1.car'), {
      keepConsumed: false,
      maxBuffered: 0,
    })
    expect(await failure(readAll(reader, HAMT_V1, ['f299.txt'], 1 << 20))).toBe('too-large')
  })
})
