// Загрузка веб-воркера без OPFS: подменная нода с Range (обрывы, порча, 404,
// без Range, скрытый CORS-ом Content-Range) и файл в памяти. Те же случаи,
// что в тестах src-tauri/src/offline/download.rs.

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  DlError,
  SPARE,
  StopSignal,
  Verifier,
  downloadFile,
  fallbackState,
  fetchExtras,
  finishState,
  loadHashes,
  parseContentRange,
  parseHashes,
  parseSavedHashes,
  patchMeta,
  snapToFragment,
  throttle,
  validExtraName,
  validId,
  validUrl,
  validateJob,
  type DownloadFile,
  type HttpFetch,
  type HttpResponse,
  type Policy,
} from './download-core'
import type { OfflineState } from './types'

const QUICK: Policy = { chunk: 64 * 1024, retryDelays: [10, 10, 10], stallMs: 5000 }

function sample(len: number): Uint8Array {
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = (i * 7 + Math.floor(i / 251)) & 0xff
  return out
}

/** Суммы как у PeerTube: заголовок без суммы, дальше фрагменты. */
function hashesJson(data: Uint8Array, name: string, header: number, fragment: number): string {
  const map: Record<string, string> = {}
  for (let start = header; start < data.length; ) {
    const end = Math.min(start + fragment, data.length) - 1
    map[`${start}-${end}`] = createHash('sha256')
      .update(data.subarray(start, end + 1))
      .digest('hex')
    start = end + 1
  }
  return JSON.stringify({ [name]: map })
}

interface Knobs {
  /** Отдать столько байт тела и оборвать (один раз). */
  cutAfter: number | null
  /** Испортить байт по смещению (столько раз). */
  corruptAt: [number, number] | null
  missing: boolean
  noRange: boolean
  /** Показывать Content-Range (у PeerTube его прячет CORS). */
  exposeRange: boolean
  /** Ответ 206 без тела. */
  empty: boolean
  served: number
  requests: number
}

function headers(map: Record<string, string>): HttpResponse['headers'] {
  return { get: (name) => map[name.toLowerCase()] ?? null }
}

/** Тело кусками по 16 КиБ, по запросу читателя: `served` — сколько реально ушло. */
function stream(
  body: Uint8Array,
  knobs: Knobs,
  cut: number | null,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  let at = 0
  const limit = cut === null ? body.length : Math.min(cut, body.length)
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal.aborted) {
        controller.error(new DOMException('aborted', 'AbortError'))
        return
      }
      if (at >= limit) {
        if (cut !== null) controller.error(new TypeError('connection reset'))
        else controller.close()
        return
      }
      const end = Math.min(at + 16 * 1024, limit)
      const piece = body.slice(at, end)
      knobs.served += piece.length
      at = end
      controller.enqueue(piece)
    },
  })
}

function node(data: Uint8Array, hashes = '{}') {
  const knobs: Knobs = {
    cutAfter: null,
    corruptAt: null,
    missing: false,
    noRange: false,
    exposeRange: false,
    empty: false,
    served: 0,
    requests: 0,
  }
  const fetch: HttpFetch = async (url, init) => {
    if (url.endsWith('/sha.json')) {
      const body = new TextEncoder().encode(hashes)
      return { status: 200, headers: headers({}), body: stream(body, knobs, null, init.signal) }
    }
    knobs.requests++
    if (knobs.missing || !url.endsWith('/video.mp4')) {
      return { status: 404, headers: headers({}), body: null }
    }
    const total = data.length
    const range = init.headers?.Range
    let start = 0
    let end = total - 1
    let status = 200
    if (range && !knobs.noRange) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (!m) throw new Error(`bad range ${range}`)
      start = Number(m[1])
      end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1
      status = 206
      if (start >= total) return { status: 416, headers: headers({}), body: null }
    }
    const body = data.slice(start, end + 1)
    if (knobs.corruptAt) {
      const [at, times] = knobs.corruptAt
      if (times > 0 && at >= start && at <= end) {
        body[at - start] = body[at - start]! ^ 0xff
        knobs.corruptAt = [at, times - 1]
      }
    }
    const map: Record<string, string> = { 'content-length': String(body.length) }
    if (status === 206 && knobs.exposeRange) map['content-range'] = `bytes ${start}-${end}/${total}`
    const cut = knobs.cutAfter
    knobs.cutAfter = null
    const payload = knobs.empty ? new Uint8Array(0) : body
    return { status, headers: headers(map), body: stream(payload, knobs, cut, init.signal) }
  }
  return { fetch, knobs }
}

class MemoryFile implements DownloadFile {
  data = new Uint8Array(0)
  len = 0
  writes = 0
  quotaAfter: number | null = null

  constructor(initial?: Uint8Array) {
    if (initial) {
      this.data = initial.slice()
      this.len = initial.length
    }
  }

  async size(): Promise<number> {
    return this.len
  }

  async write(at: number, bytes: Uint8Array): Promise<void> {
    if (this.quotaAfter !== null && at + bytes.length > this.quotaAfter) {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    this.writes++
    const need = at + bytes.length
    if (need > this.data.length) {
      const grown = new Uint8Array(Math.max(need, this.data.length * 2))
      grown.set(this.data.subarray(0, this.len))
      this.data = grown
    }
    this.data.set(bytes, at)
    this.len = Math.max(this.len, need)
  }

  async truncate(len: number): Promise<void> {
    if (len < this.len) this.data.fill(0, len, this.len)
    this.len = len
  }

  async flush(): Promise<void> {}

  bytes(): Uint8Array {
    return this.data.slice(0, this.len)
  }
}

/** Глубокое `toEqual` на сотнях КБ идёт секундами — сравниваем байты сами. */
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function queued(total = 0): OfflineState {
  return { status: 'queued', received: 0, total }
}

async function run(opts: {
  fetch: HttpFetch
  sources?: string[]
  size: number
  state?: OfflineState
  file?: MemoryFile
  hashes?: string
  stop?: StopSignal
  free?: number | null
  onPersist?: (s: OfflineState) => void
}) {
  const state = opts.state ?? queued()
  const file = opts.file ?? new MemoryFile()
  const stop = opts.stop ?? new StopSignal()
  const persisted: OfflineState[] = []
  const hashes = opts.hashes ? (parseHashes(opts.hashes, 'video.mp4') ?? []) : []
  let error: unknown = null
  try {
    await downloadFile({
      sources: opts.sources ?? ['https://node.test/video.mp4'],
      size: opts.size,
      state,
      file,
      hashes,
      fetch: opts.fetch,
      policy: QUICK,
      stop,
      free: async () => opts.free ?? null,
      report: (s, persist) => {
        if (!persist) return
        persisted.push({ ...s })
        opts.onPersist?.(s)
      },
    })
  } catch (e) {
    error = e
  }
  return { state, file, persisted, error }
}

function code(e: unknown): string | null {
  return e instanceof DlError ? e.code : e === null ? null : String(e)
}

describe('downloadFile', () => {
  it('качает кусками и проверяет каждый фрагмент', async () => {
    const data = sample(300_000)
    const hashes = hashesJson(data, 'video.mp4', 1343, 50_000)
    const { fetch, knobs } = node(data)
    // Размер заранее не известен — Content-Range виден (как у своего прокси).
    knobs.exposeRange = true
    const { state, file, persisted, error } = await run({ fetch, size: 0, hashes })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(state.received).toBe(300_000)
    expect(state.total).toBe(300_000)
    // Куски по 64 КиБ.
    expect(knobs.requests).toBe(5)
    expect(persisted.length).toBeGreaterThanOrEqual(5)
  })

  it('без видимого Content-Range (CORS) размер берётся из задания', async () => {
    const data = sample(300_000)
    const { fetch, knobs } = node(data)
    const { state, file, error } = await run({
      fetch,
      size: 300_000,
      hashes: hashesJson(data, 'video.mp4', 1343, 50_000),
    })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(state.total).toBe(300_000)
    expect(knobs.requests).toBe(5)
  })

  it('без размера и без Content-Range — до короткого куска', async () => {
    const data = sample(200_000)
    const { fetch } = node(data)
    const { state, file, error } = await run({ fetch, size: 0 })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(state.total).toBe(200_000)
  })

  it('продолжает с последнего целого фрагмента', async () => {
    const data = sample(300_000)
    const { fetch, knobs } = node(data)
    // Прошлый раз записал 120 000 байт, но это середина фрагмента 101 343…
    const file = new MemoryFile(data.subarray(0, 120_000))
    const { error } = await run({
      fetch,
      size: 300_000,
      file,
      hashes: hashesJson(data, 'video.mp4', 1343, 50_000),
      state: { status: 'downloading', received: 120_000, total: 300_000 },
    })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    // …поэтому продолжили с его начала, а не с нуля.
    expect(knobs.served).toBe(300_000 - 101_343)
  })

  it('на диске меньше, чем в state.json, — с того, что на диске', async () => {
    const data = sample(200_000)
    const { fetch, knobs } = node(data)
    const file = new MemoryFile(data.subarray(0, 70_000))
    const { error } = await run({
      fetch,
      size: 200_000,
      file,
      state: { status: 'downloading', received: 150_000, total: 200_000 },
    })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(knobs.served).toBe(130_000)
  })

  it('побитый фрагмент качается заново', async () => {
    const data = sample(300_000)
    const { fetch, knobs } = node(data)
    knobs.corruptAt = [160_000, 1]
    const { file, error } = await run({
      fetch,
      size: 300_000,
      hashes: hashesJson(data, 'video.mp4', 1343, 50_000),
    })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
  })

  it('дважды побитый фрагмент — сбой hash_mismatch', async () => {
    const data = sample(300_000)
    const { fetch, knobs } = node(data)
    knobs.corruptAt = [160_000, 10]
    const { state, error } = await run({
      fetch,
      size: 300_000,
      hashes: hashesJson(data, 'video.mp4', 1343, 50_000),
    })
    expect(code(error)).toBe('hash_mismatch')
    // Целое до побитого фрагмента осталось.
    expect(state.received).toBe(151_343)
  })

  it('обрыв повторяется с того места, где оборвался, — ни байта дважды', async () => {
    const data = sample(200_000)
    const { fetch, knobs } = node(data)
    knobs.cutAfter = 10_000
    const { file, error } = await run({ fetch, size: 200_000 })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(knobs.served).toBe(200_000)
  })

  it('нода без Range (200 с начала) тоже годится', async () => {
    const data = sample(150_000)
    const { fetch, knobs } = node(data)
    knobs.noRange = true
    const { file, error } = await run({
      fetch,
      size: 150_000,
      hashes: hashesJson(data, 'video.mp4', 1343, 40_000),
    })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(knobs.requests).toBe(1)
  })

  it('без Range после обрыва — пропускает уже скачанное', async () => {
    const data = sample(150_000)
    const { fetch, knobs } = node(data)
    knobs.noRange = true
    knobs.cutAfter = 70_000
    const { file, error } = await run({ fetch, size: 150_000 })
    expect(error).toBeNull()
    expect(same(file.bytes(), data)).toBe(true)
    expect(knobs.requests).toBe(2)
  })

  it('первый адрес 404 — следующий; 404 везде — not_found', async () => {
    const data = sample(100_000)
    const dead = node(data)
    dead.knobs.missing = true
    const alive = node(data)
    const fetch: HttpFetch = (url, init) =>
      url.startsWith('https://dead.test') ? dead.fetch(url, init) : alive.fetch(url, init)
    const ok = await run({
      fetch,
      size: 100_000,
      sources: ['https://dead.test/video.mp4', 'https://alive.test/video.mp4'],
    })
    expect(ok.error).toBeNull()
    expect(same(ok.file.bytes(), data)).toBe(true)

    const gone = await run({
      fetch: dead.fetch,
      size: 100_000,
      sources: ['https://dead.test/video.mp4', 'https://dead2.test/video.mp4'],
    })
    expect(code(gone.error)).toBe('not_found')
  })

  it('сеть так и не ответила — network после повторов, адреса по кругу', async () => {
    const seen: string[] = []
    const fetch: HttpFetch = async (url) => {
      seen.push(url)
      throw new TypeError('Failed to fetch')
    }
    const { error } = await run({
      fetch,
      size: 1000,
      sources: ['https://a.test/video.mp4', 'https://b.test/video.mp4'],
    })
    expect(code(error)).toBe('network')
    // Первая попытка и три повтора.
    expect(seen).toEqual([
      'https://a.test/video.mp4',
      'https://b.test/video.mp4',
      'https://a.test/video.mp4',
      'https://b.test/video.mp4',
    ])
  })

  it('пустой 206 посреди файла не крутится без конца', async () => {
    const data = sample(100_000)
    const { fetch, knobs } = node(data)
    knobs.empty = true
    const { error } = await run({ fetch, size: 100_000 })
    expect(code(error)).toBe('network')
    expect(knobs.requests).toBe(4)
  })

  it('файл на ноде сменился (виден Content-Range) — заново с начала', async () => {
    const old = sample(300_000)
    const data = sample(250_000).map((b) => b ^ 0x5a)
    const { fetch, knobs } = node(data)
    knobs.exposeRange = true
    const file = new MemoryFile(old.subarray(0, 100_000))
    const { state, error } = await run({
      fetch,
      size: 300_000,
      file,
      state: { status: 'downloading', received: 100_000, total: 300_000 },
    })
    expect(error).toBeNull()
    expect(state.total).toBe(250_000)
    expect(same(file.bytes(), data)).toBe(true)
  })

  it('пауза сохраняет скачанное', async () => {
    const data = sample(2_000_000)
    const { fetch } = node(data)
    const stop = new StopSignal()
    const { state, file, error } = await run({
      fetch,
      size: 2_000_000,
      stop,
      onPersist: (s) => {
        if (s.received >= 200_000) stop.stop('pause')
      },
    })
    expect(code(error)).toBe('stopped')
    expect(state.received).toBeGreaterThanOrEqual(200_000)
    expect(state.received).toBeLessThan(2_000_000)
    expect(file.len).toBeGreaterThanOrEqual(state.received)
    expect(same(file.bytes().subarray(0, state.received), data.subarray(0, state.received))).toBe(
      true
    )
  })

  it('пауза посреди куска обрывает запрос сразу', async () => {
    const data = sample(1_000_000)
    const { fetch, knobs } = node(data)
    const stop = new StopSignal()
    const file = new MemoryFile()
    const write = file.write.bind(file)
    file.write = async (at, bytes) => {
      await write(at, bytes)
      if (file.len >= 20_000) stop.stop('pause')
    }
    const { state, error } = await run({ fetch, size: 1_000_000, file, stop })
    expect(code(error)).toBe('stopped')
    // Остановились в первом куске (64 КиБ), не дочитав его.
    expect(knobs.requests).toBe(1)
    expect(state.received).toBeLessThan(QUICK.chunk)
  })

  it('места не хватит — no_space до первого запроса', async () => {
    const data = sample(10_000)
    const { fetch, knobs } = node(data)
    const { error } = await run({ fetch, size: 10_000, free: SPARE })
    expect(code(error)).toBe('no_space')
    expect(knobs.requests).toBe(0)
    const enough = await run({ fetch, size: 10_000, free: SPARE + 10_000 })
    expect(enough.error).toBeNull()
  })

  it('место кончилось по ходу — disk_full, скачанное на месте', async () => {
    const data = sample(300_000)
    const { fetch } = node(data)
    const file = new MemoryFile()
    file.quotaAfter = 150_000
    const { state, persisted, error } = await run({ fetch, size: 300_000, file })
    expect(code(error)).toBe('disk_full')
    expect(state.received).toBeLessThanOrEqual(150_000)
    expect(persisted[persisted.length - 1]?.received).toBe(state.received)
    expect(finishState(state, { error }).status).toBe('paused')
    expect(finishState(state, { error }).error).toBe('disk_full')
  })

  it('файл короче сумм — hash_mismatch', async () => {
    const data = sample(300_000)
    const { fetch } = node(data.subarray(0, 200_000))
    const { error } = await run({
      fetch,
      size: 200_000,
      hashes: hashesJson(data, 'video.mp4', 1343, 50_000),
    })
    expect(code(error)).toBe('hash_mismatch')
  })
})

describe('суммы и мелочи', () => {
  it('суммы читаются так, как их пишет PeerTube', () => {
    expect(
      parseHashes('{"a.mp4":{"1343-101448":"AB","101449-207003":"00"},"b.mp4":{}}', 'a.mp4')
    ).toEqual([])
    const sha = 'a'.repeat(64)
    const body = `{"a.mp4":{"101449-207003":"${sha.toUpperCase()}","1343-101448":"${sha}"}}`
    const ranges = parseHashes(body, 'a.mp4')
    expect(ranges?.[0]).toEqual([1343, 101_448, sha])
    expect(ranges?.[1]?.[0]).toBe(101_449)
    expect(ranges?.[1]?.[2]).toBe(sha)
    expect(parseHashes(body, 'b.mp4')).toBeNull()
    expect(parseHashes('not json', 'a.mp4')).toBeNull()
    expect(parseHashes(`{"a.mp4":{"0-10":"${sha}","5-20":"${sha}"}}`, 'a.mp4')).toBeNull()
    expect(parseSavedHashes(JSON.stringify(ranges))).toEqual(ranges)
    expect(parseSavedHashes('[[1, "x"]]')).toBeNull()
    if (!ranges) throw new Error('no ranges')
    expect(snapToFragment(ranges, 120_000)).toBe(101_449)
    expect(snapToFragment(ranges, 101_449)).toBe(101_449)
    expect(snapToFragment(ranges, 500)).toBe(500)
    expect(parseContentRange('bytes 0-99/1234')).toEqual({ start: 0, total: 1234 })
    expect(parseContentRange('bytes */1234')).toBeNull()
  })

  it('проверка делит запись по границам фрагментов', async () => {
    const data = sample(1000)
    const sha = (a: number, b: number) =>
      createHash('sha256')
        .update(data.subarray(a, b + 1))
        .digest('hex')
    const v = new Verifier(
      [
        [100, 499, sha(100, 499)],
        [500, 999, sha(500, 999)],
      ],
      0
    )
    expect(v.piece(0, 1000)).toBe(100)
    expect(await v.absorb(0, data.subarray(0, 100))).toEqual({ ok: true })
    expect(v.piece(100, 900)).toBe(400)
    expect(await v.absorb(100, data.subarray(100, 500))).toEqual({ ok: true })
    const bad = data.slice(500, 1000)
    bad[10] = bad[10]! ^ 1
    expect(await v.absorb(500, bad)).toEqual({ ok: false, retryFrom: 500 })
    expect(v.complete()).toBe(false)
    await expect(v.absorb(500, bad)).rejects.toMatchObject({ code: 'hash_mismatch' })
  })

  it('ход загрузки — не чаще раза в 250 мс', () => {
    let t = 0
    const due = throttle(250, () => t)
    const fired: number[] = []
    for (t = 0; t <= 1000; t += 50) if (due()) fired.push(t)
    expect(fired).toEqual([0, 250, 500, 750, 1000])
  })

  it('имена и адреса не уводят из папки', () => {
    expect(validId('238e3bd3-e707-4cb1-acb2-06b8594b71a5-360')).toBe(true)
    expect(validId('')).toBe(false)
    expect(validId('../x')).toBe(false)
    expect(validId('a/b')).toBe(false)
    expect(validId('a.b')).toBe(false)
    expect(validExtraName('thumb.jpg')).toBe(true)
    expect(validExtraName('captions/pt-BR.vtt')).toBe(true)
    expect(validExtraName('captions/../meta.vtt')).toBe(false)
    expect(validExtraName('captions/.vtt')).toBe(false)
    expect(validExtraName('video.mp4')).toBe(false)
    expect(validExtraName('meta.json')).toBe(false)
    expect(validUrl('https://peertube701.pocketnet.app/static/x.mp4')).toBe(true)
    expect(validUrl('file:///etc/passwd')).toBe(false)
    expect(validUrl('bastyon-offline://localhost/x')).toBe(false)
    const job = {
      id: 'v-144',
      sources: ['https://a.test/v.mp4'],
      fileName: 'v.mp4',
      sha256Urls: [],
      extras: [{ name: 'thumb.jpg', url: 'https://a.test/t.jpg' }],
      size: 10,
    }
    expect(validateJob(job)).toEqual(job)
    expect(() => validateJob({ ...job, id: '../x' })).toThrow('invalid_id')
    expect(() => validateJob({ ...job, sources: [] })).toThrow('invalid_sources')
    expect(() =>
      validateJob({ ...job, extras: [{ name: 'meta.json', url: 'https://a.test/x' }] })
    ).toThrow('invalid_extras')
    expect(() => validateJob({ ...job, size: -1 })).toThrow('invalid_job')
  })

  it('patchMeta сливает поля, null убирает, id не меняется', () => {
    const meta = { id: 'a', title: 't', accounts: ['x'] }
    expect(
      patchMeta(meta, { id: 'b', accounts: ['x', 'y'], title: null, authorDeleted: 5 })
    ).toEqual({ id: 'a', accounts: ['x', 'y'], authorDeleted: 5 })
    expect(() => patchMeta(meta, 'x')).toThrow('invalid_patch')
  })

  it('итог загрузки и потерянное состояние', () => {
    const s: OfflineState = { status: 'downloading', received: 90, total: 100, error: 'network' }
    expect(finishState(s, null)).toEqual({ status: 'done', received: 100, total: 100 })
    expect(finishState(s, { error: new DlError('stopped') })).toEqual({
      status: 'paused',
      received: 90,
      total: 100,
    })
    expect(finishState(s, { error: new DlError('not_found') }).status).toBe('failed')
    expect(finishState(s, { error: new Error('x') }).error).toBe('io')
    expect(fallbackState(500, null, 0)).toEqual({ status: 'done', received: 500, total: 500 })
    expect(fallbackState(null, 300, 1000)).toEqual({
      status: 'failed',
      received: 300,
      total: 1000,
      error: 'io',
    })
  })

  it('суммы: сохранённые раньше сети; обложки — по возможности', async () => {
    const data = sample(10_000)
    const json = hashesJson(data, 'video.mp4', 100, 4000)
    const { fetch } = node(data, json)
    const stop = new StopSignal()
    let saved: string | null = null
    const ranges = await loadHashes({
      fetch,
      urls: ['https://dead.test/nope.json', 'https://node.test/sha.json'],
      fileName: 'video.mp4',
      stop,
      saved: async () => saved,
      save: async (text) => {
        saved = text
      },
    })
    expect(ranges.length).toBe(3)
    expect(parseSavedHashes(saved)).toEqual(ranges)
    const again = await loadHashes({
      fetch: async () => {
        throw new Error('no network')
      },
      urls: ['https://node.test/sha.json'],
      fileName: 'video.mp4',
      stop,
      saved: async () => saved,
      save: async () => {},
    })
    expect(again).toEqual(ranges)

    const written: string[] = []
    await fetchExtras({
      fetch,
      stop,
      extras: [
        { name: 'thumb.jpg', url: 'https://node.test/missing.jpg' },
        { name: 'avatar.jpg', url: 'https://node.test/sha.json' },
        { name: 'captions/ru.vtt', url: 'https://node.test/sha.json' },
      ],
      exists: async (name) => name === 'captions/ru.vtt',
      write: async (name) => {
        written.push(name)
      },
    })
    expect(written).toEqual(['avatar.jpg'])
  })
})
