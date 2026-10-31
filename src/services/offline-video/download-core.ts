// Загрузка одного ролика кусками по Range с докачкой и проверкой — чистая
// логика веб-воркера (web-worker.ts), без OPFS: сеть (`HttpFetch`) и файл
// (`DownloadFile`) подставляет тот, кто зовёт, поэтому всё это проверяется
// в vitest. Повторяет src-tauri/src/offline/download.rs:
//
// - Кусок — 4 МиБ; после каждого `state.json` записан, и обрыв, перезагрузка
//   вкладки или смена сети продолжают с последнего целого куска.
// - Суммы фрагментов (`segmentsSha256Url` PeerTube: `{ "<файл>": {
//   "<начало>-<конец>": "<sha256>" } }`, концы включительно) проверяются,
//   пока фрагмент пишется. Не сошлось — фрагмент качается заново, второй раз
//   не сошлось — сбой. `crypto.subtle` не умеет считать по частям, поэтому
//   фрагмент (у PeerTube — сотни КБ) держится в памяти до проверки.
// - Сбой сети — повтор через 1, 2, 5, 15, 30 с, каждый раз со следующего
//   адреса. 404 на всех адресах — `not_found`.
// - Ноды PeerTube не открывают странице заголовок `Content-Range` (нет
//   `Access-Control-Expose-Headers`, проверено 31.10): на `206` без него
//   кусок считается начатым с запрошенного места, а размер берётся из
//   задания (`files[].size`). Когда заголовок виден — как в Rust.

import type { OfflineJob, OfflineState } from './types'

export const MIB = 1024 * 1024
/** Сверх размера ролика должно оставаться свободным. */
export const SPARE = 200 * MIB
/** Обложка, аватар, субтитры — не больше. */
export const EXTRA_MAX = 20 * MIB
export const HASHES_MAX = 5 * MIB
/** Фрагмент длиннее — суммы чужого вида: столько держать в памяти не будем. */
export const FRAGMENT_MAX = 64 * MIB
export const SMALL_TIMEOUT_MS = 20_000
/** Ход загрузки наружу — не чаще 4 раз в секунду. */
export const PROGRESS_EVERY_MS = 250

export const VIDEO = 'video.mp4'
export const PART = 'video.mp4.part'
export const META = 'meta.json'
export const STATE = 'state.json'
export const JOB = 'job.json'
export const HASHES = 'sha256.json'

export interface Policy {
  chunk: number
  retryDelays: number[]
  /** Пауза без единого байта, после которой запрос считается оборванным. */
  stallMs: number
}

export const DEFAULT_POLICY: Policy = {
  chunk: 4 * MIB,
  retryDelays: [1000, 2000, 5000, 15_000, 30_000],
  stallMs: 60_000,
}

// --- Сеть и файл -----------------------------------------------------------

/** Что нужно от ответа; настоящий `Response` подходит. */
export interface HttpResponse {
  status: number
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | null
}

export type HttpFetch = (
  url: string,
  init: { headers?: Record<string, string>; signal: AbortSignal }
) => Promise<HttpResponse>

/** Файл, в который пишется ролик (в воркере — `FileSystemSyncAccessHandle`). */
export interface DownloadFile {
  size(): Promise<number>
  /** Бросает `QuotaExceededError`, когда кончилось место. */
  write(at: number, data: Uint8Array): Promise<void>
  truncate(len: number): Promise<void>
  flush(): Promise<void>
}

// --- Остановка и ошибки ----------------------------------------------------

export type StopReason = 'pause' | 'remove'

/** Чем остановить загрузку: пауза или удаление. Срабатывает один раз. */
export class StopSignal {
  reason: StopReason | null = null
  private listeners = new Set<() => void>()

  stop(reason: StopReason): void {
    if (this.reason === 'remove') return
    const first = this.reason === null
    this.reason = reason
    if (!first) return
    for (const cb of [...this.listeners]) cb()
  }

  onStop(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}

export type DlCode =
  | 'stopped'
  | 'not_found'
  | 'network'
  | 'hash_mismatch'
  | 'no_space'
  | 'disk_full'
  | 'io'

export class DlError extends Error {
  readonly code: DlCode
  constructor(code: DlCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'DlError'
    this.code = code
  }
}

/** Фрагмент дважды не сошёлся; `from` — его начало: дальше него скачанного нет. */
export class HashMismatch extends DlError {
  readonly from: number
  constructor(from: number, end: number) {
    super('hash_mismatch', `${from}-${end}`)
    this.from = from
  }
}

function errorName(e: unknown): string {
  return typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : ''
}

/** Кончилось место: `QuotaExceededError` у OPFS. */
export function isQuotaError(e: unknown): boolean {
  return errorName(e) === 'QuotaExceededError'
}

function stopped(stop: StopSignal): DlError | null {
  return stop.reason ? new DlError('stopped', stop.reason) : null
}

export function throwIfStopped(stop: StopSignal): void {
  const e = stopped(stop)
  if (e) throw e
}

/** Запись на диск: место кончилось — `disk_full`, прочее — `io`. */
function diskError(e: unknown): DlError {
  if (e instanceof DlError) return e
  return isQuotaError(e) ? new DlError('disk_full') : new DlError('io', String(e))
}

/** Пауза, которую прерывает остановка. */
export function wait(ms: number, stop: StopSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (): void => {
      clearTimeout(timer)
      off()
      const e = stopped(stop)
      if (e) reject(e)
      else resolve()
    }
    const timer = setTimeout(done, ms)
    const off = stop.onStop(done)
    if (stop.reason) done()
  })
}

// --- Суммы фрагментов ------------------------------------------------------

/** Фрагмент с суммой: `[начало, конец]` включительно — как `HashRange` в Rust. */
export type HashRange = [start: number, end: number, sha: string]

const DIGITS = /^\d+$/
const SHA = /^[0-9a-fA-F]{64}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Перекрытия или слишком длинные фрагменты — чужой формат: без проверки лучше, чем ложный сбой. */
function usable(ranges: HashRange[]): HashRange[] | null {
  ranges.sort((a, b) => a[0] - b[0])
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i] as HashRange
    if (r[1] - r[0] + 1 > FRAGMENT_MAX) return null
    const prev = ranges[i - 1]
    if (prev && r[0] <= prev[1]) return null
  }
  return ranges
}

/** Суммы одного файла из ответа `segmentsSha256Url`, по порядку. */
export function parseHashes(body: string, fileName: string): HashRange[] | null {
  let all: unknown
  try {
    all = JSON.parse(body)
  } catch {
    return null
  }
  if (!isRecord(all) || !Object.prototype.hasOwnProperty.call(all, fileName)) return null
  const mine = all[fileName]
  if (!isRecord(mine)) return null
  const ranges: HashRange[] = []
  for (const span of Object.keys(mine)) {
    const sha = mine[span]
    if (typeof sha !== 'string') return null
    const dash = span.indexOf('-')
    if (dash < 0) continue
    const a = span.slice(0, dash)
    const b = span.slice(dash + 1)
    if (!DIGITS.test(a) || !DIGITS.test(b)) continue
    const start = Number(a)
    const end = Number(b)
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (end < start || !SHA.test(sha)) continue
    ranges.push([start, end, sha.toLowerCase()])
  }
  return usable(ranges)
}

/** Суммы, сохранённые в `sha256.json` (тот же вид, что пишет Rust). */
export function parseSavedHashes(text: string | null): HashRange[] | null {
  if (!text) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(raw)) return null
  const ranges: HashRange[] = []
  for (const r of raw) {
    if (!Array.isArray(r) || r.length !== 3) return null
    const [start, end, sha] = r as unknown[]
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null
    if (typeof sha !== 'string' || !SHA.test(sha) || (end as number) < (start as number)) {
      return null
    }
    ranges.push([start as number, end as number, sha.toLowerCase()])
  }
  return usable(ranges)
}

/** Продолжать с начала фрагмента: середину уже не проверить. */
export function snapToFragment(ranges: HashRange[], pos: number): number {
  const r = ranges.find((x) => pos > x[0] && pos <= x[1])
  return r ? r[0] : pos
}

export async function sha256hex(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>)
  )
  let out = ''
  for (const b of digest) out += (b < 16 ? '0' : '') + b.toString(16)
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0] as Uint8Array
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Итог записанного куска: всё в порядке или писать заново с этого места. */
export type Checked = { ok: true } | { ok: false; retryFrom: number }

const OK: Checked = { ok: true }

/** Сверяет фрагменты по мере записи. */
export class Verifier {
  /** Первый ещё не проверенный фрагмент. */
  private next = 0
  private parts: Uint8Array[] | null = null
  private strikes = new Map<number, number>()
  private readonly ranges: HashRange[]

  constructor(ranges: HashRange[], pos: number) {
    this.ranges = ranges
    this.seek(pos)
  }

  seek(pos: number): void {
    const i = this.ranges.findIndex((r) => r[1] >= pos)
    this.next = i < 0 ? this.ranges.length : i
    this.parts = null
  }

  /** Сколько байт с `pos` можно записать до следующей границы фрагмента. */
  piece(pos: number, len: number): number {
    const r = this.ranges[this.next]
    if (!r) return len
    if (pos < r[0]) return Math.min(len, r[0] - pos)
    return Math.min(len, r[1] + 1 - pos)
  }

  /**
   * Записанный кусок `[pos, pos + data.length)` — внутри одного фрагмента
   * или между ними (см. `piece`). `data` не должен меняться после вызова.
   */
  async absorb(pos: number, data: Uint8Array): Promise<Checked> {
    const r = this.ranges[this.next]
    if (!r || pos < r[0]) return OK
    if (pos === r[0]) this.parts = []
    // Сюда без начала фрагмента не попасть: продолжаем всегда с его начала.
    if (!this.parts) return OK
    this.parts.push(data)
    if (pos + data.length !== r[1] + 1) return OK
    const actual = await sha256hex(concat(this.parts))
    this.parts = null
    const index = this.next
    this.next += 1
    if (actual === r[2]) return OK
    const strikes = (this.strikes.get(index) ?? 0) + 1
    this.strikes.set(index, strikes)
    this.seek(r[0])
    if (strikes >= 2) throw new HashMismatch(r[0], r[1])
    return { ok: false, retryFrom: r[0] }
  }

  /** Все фрагменты проверены (или проверять нечего). */
  complete(): boolean {
    return this.next >= this.ranges.length
  }
}

// --- Мелочи ----------------------------------------------------------------

/** `bytes 0-99/1234` → { start: 0, total: 1234 }. */
export function parseContentRange(value: string): { start: number; total: number } | null {
  const m = /^bytes\s+(\d+)-(\d+)\/(\d+)$/.exec(value.trim())
  if (!m) return null
  const start = Number(m[1])
  const total = Number(m[3])
  return Number.isSafeInteger(start) && Number.isSafeInteger(total) ? { start, total } : null
}

/** Не чаще раза в `everyMs`: true — пора. */
export function throttle(everyMs: number, now: () => number = Date.now): () => boolean {
  let last = -Infinity
  return () => {
    const t = now()
    if (t - last < everyMs) return false
    last = t
    return true
  }
}

// --- Небольшие файлы: суммы, обложка, субтитры -----------------------------

/** Небольшой файл целиком. Бросает `Error` с причиной; остановка — `DlError('stopped')`. */
export async function fetchSmall(
  fetch: HttpFetch,
  url: string,
  max: number,
  stop: StopSignal,
  timeoutMs = SMALL_TIMEOUT_MS
): Promise<Uint8Array> {
  throwIfStopped(stop)
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, timeoutMs)
  const off = stop.onStop(() => ctrl.abort())
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (res.status < 200 || res.status > 299) {
      void res.body?.cancel().catch(() => {})
      throw new Error(`http ${res.status}`)
    }
    const length = Number(res.headers.get('content-length'))
    if (length > max) {
      void res.body?.cancel().catch(() => {})
      throw new Error('too_large')
    }
    const parts: Uint8Array[] = []
    let got = 0
    if (res.body) {
      reader = res.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        got += value.length
        if (got > max) throw new Error('too_large')
        parts.push(value)
      }
    }
    return parts.length ? concat(parts) : new Uint8Array(0)
  } catch (e) {
    throwIfStopped(stop)
    throw timedOut ? new Error('timeout') : e
  } finally {
    clearTimeout(timer)
    off()
    reader?.cancel().catch(() => {})
  }
}

/**
 * Суммы фрагментов: сохранённые, а нет — с ноды (и сохранить). Не вышло —
 * без проверки: ролик всё равно скачается.
 */
export async function loadHashes(opts: {
  fetch: HttpFetch
  urls: string[]
  fileName: string
  stop: StopSignal
  saved: () => Promise<string | null>
  save: (text: string) => Promise<void>
  log?: (msg: string) => void
}): Promise<HashRange[]> {
  const saved = parseSavedHashes(await opts.saved().catch(() => null))
  if (saved) return saved
  for (const url of opts.urls) {
    try {
      const body = await fetchSmall(opts.fetch, url, HASHES_MAX, opts.stop)
      const ranges = parseHashes(new TextDecoder().decode(body), opts.fileName)
      if (ranges) {
        await opts.save(JSON.stringify(ranges)).catch(() => {})
        return ranges
      }
      opts.log?.(`no hashes for ${opts.fileName} at ${url}`)
    } catch (e) {
      throwIfStopped(opts.stop)
      opts.log?.(`hashes unavailable: ${String(e)}`)
    }
  }
  return []
}

/** Обложка, аватар и субтитры — по возможности: без них ролик всё равно играет. */
export async function fetchExtras(opts: {
  fetch: HttpFetch
  extras: { name: string; url: string }[]
  stop: StopSignal
  exists: (name: string) => Promise<boolean>
  write: (name: string, bytes: Uint8Array) => Promise<void>
  log?: (msg: string) => void
}): Promise<void> {
  for (const extra of opts.extras) {
    throwIfStopped(opts.stop)
    if (await opts.exists(extra.name).catch(() => false)) continue
    try {
      const body = await fetchSmall(opts.fetch, extra.url, EXTRA_MAX, opts.stop)
      await opts.write(extra.name, body)
    } catch (e) {
      throwIfStopped(opts.stop)
      opts.log?.(`${extra.name} skipped: ${String(e)}`)
    }
  }
}

// --- Сам ролик ---------------------------------------------------------------

/** Ход загрузки наружу: `persist` — записать `state.json`. */
export type Report = (state: OfflineState, persist: boolean) => void | Promise<void>

export interface DownloadParams {
  sources: string[]
  /** Размер из задания; точный приходит в `Content-Range`, если его видно. */
  size: number
  /** С прошлого раза (или новое); меняется по ходу. */
  state: OfflineState
  file: DownloadFile
  hashes: HashRange[]
  fetch: HttpFetch
  policy?: Policy
  stop: StopSignal
  report: Report
  /** Сколько свободно; null — не узнать (тогда отказа заранее нет). */
  free: () => Promise<number | null>
}

type Outcome = 'done' | 'restart'

/** Файла по этому адресу нет (404/410). */
class NotFound extends Error {}
/** Сбой сети: повторить, может быть, с другого адреса. */
class NetFail extends Error {}

class Run {
  private readonly p: DownloadParams
  private readonly policy: Policy
  private readonly verifier: Verifier

  constructor(p: DownloadParams, policy: Policy, resume: number) {
    this.p = p
    this.policy = policy
    this.verifier = new Verifier(p.hashes, resume)
  }

  private get state(): OfflineState {
    return this.p.state
  }

  get complete(): boolean {
    return this.verifier.complete()
  }

  private async restartFrom(pos: number): Promise<void> {
    await this.p.file.truncate(pos).catch((e: unknown) => Promise.reject(diskError(e)))
    this.state.received = pos
  }

  private async flush(): Promise<void> {
    await this.p.file.flush().catch((e: unknown) => Promise.reject(diskError(e)))
  }

  private netError(e: unknown, stalled: boolean): Error {
    if (e instanceof DlError) return e
    const stop = stopped(this.p.stop)
    if (stop) return stop
    return new NetFail(stalled ? 'stalled' : String(e))
  }

  async fetchChunk(url: string): Promise<Outcome> {
    const { state, policy } = this
    const start = state.received
    const end =
      state.total > 0
        ? Math.min(start + policy.chunk - 1, state.total - 1)
        : start + policy.chunk - 1
    const ctrl = new AbortController()
    let stalled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        stalled = true
        ctrl.abort()
      }, policy.stallMs)
    }
    const off = this.p.stop.onStop(() => ctrl.abort())
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      arm()
      let res: HttpResponse
      try {
        res = await this.p.fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: ctrl.signal,
        })
      } catch (e) {
        throw this.netError(e, stalled)
      }
      const drop = (): void => void res.body?.cancel().catch(() => {})
      if (res.status === 404 || res.status === 410) {
        drop()
        throw new NotFound(`http ${res.status}`)
      }
      // Размера не знали, а дошли до конца: нода говорит «дальше ничего».
      if (res.status === 416 && state.total === 0 && start > 0) {
        drop()
        state.total = start
        return 'done'
      }
      if (res.status < 200 || res.status > 299) {
        drop()
        throw new NetFail(`http ${res.status}`)
      }

      // 206 — кусок с `start`; 200 — нода не умеет Range и шлёт файл с начала.
      let skip = 0
      let total = 0
      if (res.status === 206) {
        const header = res.headers.get('content-range')
        if (header !== null) {
          const range = parseContentRange(header)
          if (!range || range.start !== start) {
            drop()
            throw new NetFail('bad content-range')
          }
          total = range.total
        }
        // Заголовка не видно (CORS) — кусок с `start`, размер из задания.
      } else {
        skip = start
        total = Number(res.headers.get('content-length')) || 0
      }
      if (total > 0 && state.total > 0 && total !== state.total && start > 0) {
        // Файл на ноде другой: прежнее скачанное к нему не подходит.
        drop()
        state.total = total
        await this.restartFrom(0)
        this.verifier.seek(0)
        return 'restart'
      }
      if (total > 0) state.total = total

      let sincePersist = 0
      let got = 0
      if (res.body) {
        reader = res.body.getReader()
        for (;;) {
          arm()
          let next: ReadableStreamReadResult<Uint8Array>
          try {
            next = await reader.read()
          } catch (e) {
            throw this.netError(e, stalled)
          }
          if (next.done) break
          let data = next.value
          if (skip > 0) {
            const n = Math.min(skip, data.length)
            skip -= n
            data = data.subarray(n)
          }
          if (state.total > 0) {
            const room = Math.max(0, state.total - state.received)
            if (data.length > room) data = data.subarray(0, room)
          }
          while (data.length > 0) {
            const pos = state.received
            const n = this.verifier.piece(pos, data.length)
            const piece = data.subarray(0, n)
            data = data.subarray(n)
            await this.p.file.write(pos, piece).catch((e: unknown) => Promise.reject(diskError(e)))
            state.received += n
            sincePersist += n
            got += n
            let checked: Checked
            try {
              checked = await this.verifier.absorb(pos, piece)
            } catch (e) {
              // Побитый фрагмент не считается скачанным: «Повторить» начнёт с него.
              if (e instanceof HashMismatch) await this.restartFrom(e.from)
              throw e
            }
            if (!checked.ok) {
              await this.restartFrom(checked.retryFrom)
              await this.flush()
              await this.p.report(state, true)
              return 'restart'
            }
          }
          if (sincePersist >= policy.chunk) {
            // Нода без Range шлёт файл целиком — сохраняемся по ходу.
            await this.flush()
            await this.p.report(state, true)
            sincePersist = 0
          } else {
            await this.p.report(state, false)
          }
          if (state.total > 0 && state.received >= state.total) break
        }
      }
      throwIfStopped(this.p.stop)
      await this.flush()
      if (state.total === 0) {
        // Размер так и не узнали: 200 — пришёл весь файл, 206 короче
        // запрошенного — это его конец.
        if (res.status !== 206 || got < end - start + 1) state.total = state.received
      }
      if (got === 0 && (state.total === 0 || state.received < state.total)) {
        // Пустой ответ посреди файла — иначе крутились бы без конца.
        throw new NetFail('empty response')
      }
      return 'done'
    } finally {
      clearTimeout(timer)
      off()
      reader?.cancel().catch(() => {})
    }
  }

  async loop(): Promise<void> {
    const { p, policy, state } = this
    const sources = p.sources
    let source = 0
    let failures = 0
    const missing = new Set<number>()
    for (;;) {
      throwIfStopped(p.stop)
      if (state.total > 0 && state.received >= state.total) break
      const index = source % sources.length
      try {
        const outcome = await this.fetchChunk(sources[index] as string)
        if (outcome === 'done') {
          failures = 0
          missing.clear()
          await p.report(state, true)
        }
      } catch (e) {
        if (e instanceof NotFound) {
          missing.add(index)
          if (missing.size >= sources.length) throw new DlError('not_found')
          source += 1
          continue
        }
        if (e instanceof NetFail) {
          await p.report(state, true)
          const delay = policy.retryDelays[failures]
          if (delay === undefined) throw new DlError('network', e.message)
          failures += 1
          source += 1
          await wait(delay, p.stop)
          continue
        }
        await Promise.resolve(p.report(state, true)).catch(() => {})
        throw e instanceof DlError ? e : diskError(e)
      }
    }
  }
}

/**
 * Скачать ролик в `file` до конца (переименование — у вызывающего).
 * Бросает `DlError`: `stopped` (пауза/удаление), `not_found`, `network`,
 * `hash_mismatch`, `no_space`, `disk_full`, `io`.
 */
export async function downloadFile(p: DownloadParams): Promise<void> {
  if (!p.sources.length) throw new DlError('not_found', 'no sources')
  const policy = p.policy ?? DEFAULT_POLICY
  const { state } = p
  const onDisk = await p.file.size().catch((e: unknown) => Promise.reject(diskError(e)))
  if (state.total === 0) state.total = p.size
  const resume = snapToFragment(p.hashes, Math.min(state.received, onDisk))
  await p.file.truncate(resume).catch((e: unknown) => Promise.reject(diskError(e)))
  state.received = resume

  const available = await p.free().catch(() => null)
  if (available !== null) {
    const needed = Math.max(0, state.total - state.received) + SPARE
    if (available < needed) throw new DlError('no_space')
  }

  const run = new Run(p, policy, resume)
  await run.loop()
  if (!run.complete) {
    // Файл кончился раньше фрагментов из сумм — это не тот файл.
    throw new DlError('hash_mismatch', 'file shorter than hashes')
  }
  await p.file.flush().catch((e: unknown) => Promise.reject(diskError(e)))
}

// --- Папка ролика: проверки и правила (как store.rs) ------------------------

/** `<uuid>-<высота>`: буквы, цифры, `-` и `_`. Ничего, что уведёт путь из папки. */
export function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && /^[A-Za-z0-9_-]+$/.test(id)
}

/** Имена дополнительных файлов, которые можно скачать и отдать странице. */
export function validExtraName(name: unknown): name is string {
  if (name === 'thumb.jpg' || name === 'avatar.jpg') return true
  if (typeof name !== 'string') return false
  const m = /^captions\/([A-Za-z0-9_-]{1,32})\.vtt$/.exec(name)
  return m !== null
}

export function validUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.length > 0
  } catch {
    return false
  }
}

/** Задание со страницы: проверено и приведено к виду `job.json`. */
export function validateJob(raw: unknown): OfflineJob {
  if (!isRecord(raw)) throw new Error('invalid_job')
  const job = raw as Partial<OfflineJob>
  if (!validId(job.id)) throw new Error('invalid_id')
  const sources = job.sources
  if (!Array.isArray(sources) || !sources.length || !sources.every(validUrl)) {
    throw new Error('invalid_sources')
  }
  const sha256Urls = job.sha256Urls ?? []
  if (!Array.isArray(sha256Urls) || !sha256Urls.every(validUrl)) {
    throw new Error('invalid_sources')
  }
  const extras = job.extras ?? []
  if (
    !Array.isArray(extras) ||
    !extras.every((e) => isRecord(e) && validExtraName(e.name) && validUrl(e.url))
  ) {
    throw new Error('invalid_extras')
  }
  const size = job.size
  if (typeof job.fileName !== 'string' || typeof size !== 'number') throw new Error('invalid_job')
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('invalid_job')
  return {
    id: job.id,
    sources: [...sources],
    fileName: job.fileName,
    sha256Urls: [...sha256Urls],
    extras: extras.map((e) => ({ name: e.name, url: e.url })),
    size,
  }
}

export function validState(raw: unknown): OfflineState | null {
  if (!isRecord(raw)) return null
  const statuses = ['queued', 'downloading', 'paused', 'failed', 'done']
  if (typeof raw.status !== 'string' || !statuses.includes(raw.status)) return null
  if (!Number.isSafeInteger(raw.received) || !Number.isSafeInteger(raw.total)) return null
  const state: OfflineState = {
    status: raw.status as OfflineState['status'],
    received: raw.received as number,
    total: raw.total as number,
  }
  if (typeof raw.error === 'string') state.error = raw.error
  return state
}

/** Состояние потерялось: готовый файл — скачан, иначе — сбой с тем, что есть на диске. */
export function fallbackState(
  videoSize: number | null,
  partSize: number | null,
  jobSize: number
): OfflineState {
  if (videoSize !== null) return { status: 'done', received: videoSize, total: videoSize }
  return { status: 'failed', received: partSize ?? 0, total: jobSize, error: 'io' }
}

/** Слить поля в `meta.json`: null — убрать поле, `id` не меняется. */
export function patchMeta(meta: Record<string, unknown>, patch: unknown): Record<string, unknown> {
  if (!isRecord(patch)) throw new Error('invalid_patch')
  const next: Record<string, unknown> = { ...meta }
  for (const key of Object.keys(patch)) {
    if (key === 'id') continue
    const value = patch[key]
    if (value === undefined) continue
    if (value === null) delete next[key]
    else next[key] = value
  }
  return next
}

/** Итог загрузки (`failure` null — скачано) → состояние, как `finish` в Rust. */
export function finishState(state: OfflineState, failure: { error: unknown } | null): OfflineState {
  const next: OfflineState = { ...state }
  delete next.error
  if (failure === null) {
    next.status = 'done'
    next.received = Math.max(next.total, next.received)
    next.total = next.received
    return next
  }
  const { error } = failure
  const code: DlCode =
    error instanceof DlError ? error.code : isQuotaError(error) ? 'disk_full' : 'io'
  if (code === 'stopped') next.status = 'paused'
  else if (code === 'disk_full') {
    next.status = 'paused'
    next.error = code
  } else {
    next.status = 'failed'
    next.error = code
  }
  return next
}
