// Узел IPFS в браузере без сети: Helia подменена, блоки — из фикстур Kubo.
// Проверяется то, что пишем мы: куда ведут имена, запасной путь, когда сессия
// Helia молчит, «не нашлось» после минуты тишины и быстрая отмена.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarBlockIterator } from '@ipld/car/iterator'
import type { CID } from 'multiformats/cid'

type Get = (cid: CID, opts: { signal: AbortSignal }) => AsyncGenerator<Uint8Array>

const h = vi.hoisted(() => ({
  sessionGet: null as unknown as Get,
  plainGet: null as unknown as Get,
  sessions: 0,
  dnslink: vi.fn(),
  ipns: vi.fn(),
}))

vi.mock('helia', () => ({
  createHelia: async () => ({
    start: async () => {},
    stop: async () => {},
    blockstore: {
      createSession: () => {
        h.sessions++
        return { get: (cid: CID, opts: { signal: AbortSignal }) => h.sessionGet(cid, opts) }
      },
      get: (cid: CID, opts: { signal: AbortSignal }) => h.plainGet(cid, opts),
    },
  }),
}))
vi.mock('@helia/dnslink', () => ({ dnsLink: () => ({ resolve: h.dnslink }) }))
vi.mock('@helia/ipns', () => ({ ipnsResolver: () => ({ resolve: h.ipns }) }))

import { NameError, TransportError } from './ipfs-errors'
import { openIpfs, stopNode } from './ipfs-node'
import { parseCid } from './ipfs-verify'

const SMALL_V0 = 'QmWmkE7shY3Z4JnHqMYqvzLvsAR5ZYhkHSuskPXSCdHKSF'
const SITE_V1 = 'bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e'
const blocks = new Map<string, Uint8Array>()

async function load(name: string): Promise<void> {
  const car = readFileSync(resolve(process.cwd(), 'src-tauri/src/ipfs/testdata', name))
  for await (const block of await CarBlockIterator.fromBytes(new Uint8Array(car))) {
    blocks.set(block.cid.multihash.bytes.join(','), block.bytes)
  }
}

/** Отдаёт блок сразу. */
const serve: Get = async function* (cid) {
  const bytes = blocks.get(cid.multihash.bytes.join(','))
  if (!bytes) throw new Error('no block')
  yield bytes
}

/** Молчит, пока запрос не отменят. */
const silent: Get = async function* (_cid, { signal }) {
  await new Promise((_, reject) =>
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  )
  yield new Uint8Array()
}

async function text(target: Parameters<typeof openIpfs>[0], signal = new AbortController().signal) {
  const { entity, name } = await openIpfs(target, { signal, maxBytes: 1 << 20 })
  if (entity.kind !== 'file') return { kind: entity.kind, name }
  let out = ''
  for await (const chunk of entity.chunks) out += new TextDecoder().decode(chunk)
  return { kind: 'file', text: out, name }
}

beforeAll(async () => {
  await load('small-v0.car')
  await load('site-v1.car')
})

beforeEach(() => {
  h.sessionGet = serve
  h.plainGet = serve
  h.sessions = 0
  h.dnslink.mockReset()
  h.ipns.mockReset()
})

afterEach(async () => {
  vi.useRealTimers()
  await stopNode()
})

describe('openIpfs', () => {
  it('CID и путь — файл из проверенных блоков', async () => {
    expect(await text({ namespace: 'ipfs', root: SITE_V1, path: 'index.html' })).toEqual({
      kind: 'file',
      text: '<h1>hi</h1>\n',
      name: null,
    })
  })

  it('DNSLink: путь записи и путь ссылки складываются', async () => {
    h.dnslink.mockResolvedValue([{ namespace: 'ipfs', cid: parseCid(SITE_V1), path: '' }])
    const got = await text({ namespace: 'ipns', root: 'docs.example.org', path: 'index.html' })
    expect(got.text).toBe('<h1>hi</h1>\n')
    expect(got.name).toEqual({
      kind: 'dnslink',
      name: 'docs.example.org',
      value: `/ipfs/${SITE_V1}`,
      validUntil: null,
    })
    expect(h.dnslink).toHaveBeenCalledWith('docs.example.org', expect.anything())
  })

  it('имя IPNS: конец цепочки и срок записи', async () => {
    async function* chain() {
      yield { value: '/ipns/k51other', record: {} }
      yield {
        value: `/ipfs/${SITE_V1}/assets`,
        record: { validity: new TextEncoder().encode('2026-11-01T10:00:00.123456789Z') },
      }
    }
    h.ipns.mockReturnValue(chain())
    const key = 'k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8'
    const got = await text({ namespace: 'ipns', root: key, path: '' })
    expect(got.kind).toBe('directory')
    expect(got.name).toEqual({
      kind: 'ipns',
      name: key,
      value: `/ipfs/${SITE_V1}/assets`,
      validUntil: new Date('2026-11-01T10:00:00.123Z'),
    })
  })

  it('имя не нашлось — NameError, а не «файл не найден»', async () => {
    h.dnslink.mockRejectedValue(
      Object.assign(new Error('no TXT'), { name: 'DNSLinkNotFoundError' })
    )
    await expect(text({ namespace: 'ipns', root: 'nope.example.org', path: '' })).rejects.toEqual(
      expect.objectContaining({ name: 'NameError', reason: 'not-found' })
    )
    h.ipns.mockImplementation(() => {
      throw Object.assign(new Error('bad sig'), { name: 'RecordsFailedValidationError' })
    })
    const key = 'k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8'
    await expect(text({ namespace: 'ipns', root: key, path: '' })).rejects.toBeInstanceOf(NameError)
  })

  it('сессия молчит — через 6 с блок просится без сессии, сессия создаётся заново', async () => {
    vi.useFakeTimers()
    h.sessionGet = silent
    const pending = text({ namespace: 'ipfs', root: SMALL_V0, path: '' })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.sessions).toBe(1)
    await vi.advanceTimersByTimeAsync(1_500)
    expect((await pending).text).toBe('hello bastyon\n')
    expect(h.sessions).toBe(2)
  })

  it('минуту никто не прислал ни блока — «в сети не нашлось»', async () => {
    vi.useFakeTimers()
    h.sessionGet = silent
    h.plainGet = silent
    const pending = text({ namespace: 'ipfs', root: SMALL_V0, path: '' })
    const failed = expect(pending).rejects.toBeInstanceOf(TransportError)
    await vi.advanceTimersByTimeAsync(61_000)
    await failed
  })

  it('отмена обрывает ожидание сразу, без «не нашлось»', async () => {
    vi.useFakeTimers()
    h.sessionGet = silent
    h.plainGet = silent
    const controller = new AbortController()
    const pending = text({ namespace: 'ipfs', root: SMALL_V0, path: '' }, controller.signal)
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(7_000)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1)
    await failed
  })
})
