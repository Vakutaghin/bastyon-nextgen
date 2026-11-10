// Веб: очередь и загрузка скачанных роликов — выделенный модульный воркер.
// Пишет в OPFS `offline/<id>/…` тем же видом, что Rust и Android (types.ts),
// через `createSyncAccessHandle`: запись по смещению, обрезка, flush. Логика
// куска, докачки и проверки сумм — в download-core.ts (общая с тестами), здесь
// только OPFS, очередь и сообщения странице (web-backend.ts).
//
// - Качается один ролик за раз, остальные ждут. Качает, пока открыта вкладка;
//   закрыли — при следующем открытии недокачанное продолжится само.
// - `video.mp4.part` → `video.mp4` через `move()`, где он есть (Chromium 110+,
//   WebKit 26 — проверено; Firefox 111+). Где его нет (старые Safari и
//   Chromium), файл остаётся `video.mp4.part`, а «скачано» записано в
//   `state.json` (`done`): `fileUrl` тогда отдаёт его. Копировать гигабайт
//   ради имени не стоит.
// - Несколько вкладок не согласуются, но и не портят файлы: загрузка ролика
//   идёт под `navigator.locks` (`bastyon-offline:<id>`). Занят другой вкладкой
//   — эта ждёт, пока он освободится, и только тогда берётся за него сама.
//   Пауза и удаление ролика, который качает другая вкладка, отвечают `busy`
//   (страница говорит, что остановить его можно только там), а эта вкладка
//   по-прежнему ждёт ту, чтобы показать итог.
// - Мелкие JSON и состояние очереди меняются по одному (`serial`): «удалить»
//   во время загрузки либо дошло до задачи (и она удаляет сама), либо задачи
//   уже нет и удаляет команда — как под замком в Rust.

import { logger } from '@/services/logger'
import {
  DEFAULT_POLICY,
  DlError,
  HASHES,
  JOB,
  META,
  PART,
  PROGRESS_EVERY_MS,
  STATE,
  StopSignal,
  VIDEO,
  downloadFile,
  fallbackState,
  fetchExtras,
  finishState,
  isQuotaError,
  loadHashes,
  patchMeta,
  throttle,
  throwIfStopped,
  validExtraName,
  validId,
  validState,
  validateJob,
  type DownloadFile,
  type HttpFetch,
  type Policy,
} from './download-core'
import type {
  OfflineChanged,
  OfflineFile,
  OfflineItem,
  OfflineJob,
  OfflineMeta,
  OfflineProgress,
  OfflineState,
  OfflineUsage,
} from './types'

// --- Сообщения со страницей ------------------------------------------------

export type WorkerCall =
  | { op: 'list' }
  | { op: 'enqueue'; job: OfflineJob; meta: OfflineMeta }
  | { op: 'pause'; id: string }
  | { op: 'resume'; id: string }
  | { op: 'remove'; id: string }
  | { op: 'patchMeta'; id: string; patch: Record<string, unknown> }
  | { op: 'usage' }
  | { op: 'clear' }
  | { op: 'file'; id: string; file: OfflineFile }
  /** Для проверок: куски поменьше, повторы быстрее. */
  | { op: 'policy'; policy: Partial<Policy> }

export type WorkerRequest = WorkerCall & { rid: number }

export type WorkerMessage =
  | { rid: number; ok: true; value: unknown }
  | { rid: number; ok: false; error: string }
  | { event: 'progress'; data: OfflineProgress }
  | { event: 'changed'; data: OfflineChanged }

// --- OPFS: типы, которых нет в lib.dom ---------------------------------------

interface SyncHandle {
  read(buffer: Uint8Array, options?: { at?: number }): number
  write(buffer: Uint8Array, options?: { at?: number }): number
  // В Chromium до 108 и в ранних Safari — промисы, дальше — сразу.
  truncate(size: number): void | Promise<void>
  getSize(): number | Promise<number>
  flush(): void | Promise<void>
  close(): void | Promise<void>
}

type FileHandle = FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<SyncHandle>
  move?: (...args: unknown[]) => Promise<void>
}

type DirHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterableIterator<FileSystemHandle>
}

interface WorkerScope {
  postMessage(message: WorkerMessage): void
  addEventListener(type: 'message', listener: (e: MessageEvent<WorkerRequest>) => void): void
}

const scope = self as unknown as WorkerScope
const log = logger.scope('[offline-worker]')

/** Сколько роликов качается сразу. */
const PARALLEL = 1
/** После открытия вкладки не мешаем ей: недокачанное продолжается чуть позже. */
const RESUME_AFTER_MS = 3000
const ROOT = 'offline'
const LOCK_PREFIX = 'bastyon-offline:'

let policy: Policy = DEFAULT_POLICY

function post(message: WorkerMessage): void {
  scope.postMessage(message)
}

// --- Свой порядок: мелкие файлы и очередь меняются по одному -----------------

let chain: Promise<unknown> = Promise.resolve()

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.catch(() => {})
  return run
}

// --- Файлы -----------------------------------------------------------------

const encoder = new TextEncoder()

function nameOf(e: unknown): string {
  return typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : ''
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let rootHandle: Promise<DirHandle> | null = null

function offlineRoot(): Promise<DirHandle> {
  if (!rootHandle) {
    const opening = navigator.storage
      .getDirectory()
      .then((opfs) => opfs.getDirectoryHandle(ROOT, { create: true }) as Promise<DirHandle>)
    // Не открылось — в следующий раз попробовать снова.
    opening.catch(() => {
      if (rootHandle === opening) rootHandle = null
    })
    rootHandle = opening
  }
  return rootHandle
}

async function itemDir(id: string, create = false): Promise<DirHandle | null> {
  if (!validId(id)) return null
  const root = await offlineRoot()
  try {
    return (await root.getDirectoryHandle(id, { create })) as DirHandle
  } catch (e) {
    if (nameOf(e) === 'NotFoundError' || nameOf(e) === 'TypeMismatchError') return null
    throw e
  }
}

/** `captions/ru.vtt` → папка `captions` и имя. */
async function fileHandle(
  dir: DirHandle,
  path: string,
  create = false
): Promise<FileHandle | null> {
  const parts = path.split('/')
  const name = parts.pop() as string
  let at: FileSystemDirectoryHandle = dir
  try {
    for (const part of parts) at = await at.getDirectoryHandle(part, { create })
    return (await at.getFileHandle(name, { create })) as FileHandle
  } catch (e) {
    if (nameOf(e) === 'NotFoundError' || nameOf(e) === 'TypeMismatchError') return null
    throw e
  }
}

async function fileSize(dir: DirHandle, path: string): Promise<number | null> {
  const fh = await fileHandle(dir, path).catch(() => null)
  if (!fh) return null
  try {
    return (await fh.getFile()).size
  } catch {
    return null
  }
}

/** Другая вкладка держит файл — подождать и попробовать ещё. */
async function openSync(fh: FileHandle): Promise<SyncHandle> {
  // OPFS есть, а записи из воркера нет (Safari до 15.2): скачивать нечем.
  if (typeof fh.createSyncAccessHandle !== 'function') throw new Error('unsupported')
  for (let attempt = 0; ; attempt++) {
    try {
      return await fh.createSyncAccessHandle()
    } catch (e) {
      const busy = nameOf(e) === 'NoModificationAllowedError' || nameOf(e) === 'InvalidStateError'
      if (!busy || attempt >= 5) throw e
      await sleep(50 * (attempt + 1))
    }
  }
}

function writeAll(h: SyncHandle, at: number, data: Uint8Array): void {
  let off = 0
  while (off < data.length) {
    const n = h.write(data.subarray(off), { at: at + off })
    if (!n) throw new DlError('io', 'short write')
    off += n
  }
}

/**
 * Небольшой файл целиком. Переименовать на место OPFS умеет не везде, поэтому
 * пишется на месте одним вызовом; недописанный JSON читается как пропавший
 * (см. `readItem`).
 */
async function writeBytes(dir: DirHandle, path: string, bytes: Uint8Array): Promise<void> {
  const fh = await fileHandle(dir, path, true)
  if (!fh) throw new DlError('io', `no ${path}`)
  const h = await openSync(fh)
  try {
    writeAll(h, 0, bytes)
    await h.truncate(bytes.length)
    await h.flush()
  } finally {
    await h.close()
  }
}

function writeJson(dir: DirHandle, name: string, value: unknown): Promise<void> {
  return writeBytes(dir, name, encoder.encode(JSON.stringify(value)))
}

async function readText(dir: DirHandle, name: string): Promise<string | null> {
  const fh = await fileHandle(dir, name).catch(() => null)
  if (!fh) return null
  try {
    return await (await fh.getFile()).text()
  } catch {
    return null
  }
}

async function readJson(dir: DirHandle, name: string): Promise<unknown> {
  const text = await readText(dir, name)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function removeFile(dir: DirHandle, name: string): Promise<void> {
  await dir.removeEntry(name).catch(() => {})
}

async function entries(dir: DirHandle): Promise<FileSystemHandle[]> {
  const out: FileSystemHandle[] = []
  if (typeof dir.values !== 'function') return out
  for await (const handle of dir.values()) out.push(handle)
  return out
}

// --- Папка ролика ------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

async function readMeta(dir: DirHandle): Promise<Record<string, unknown> | null> {
  const meta = await readJson(dir, META)
  return isObject(meta) ? meta : null
}

async function readJob(dir: DirHandle): Promise<OfflineJob | null> {
  try {
    return validateJob(await readJson(dir, JOB))
  } catch {
    return null
  }
}

async function readState(dir: DirHandle): Promise<OfflineState | null> {
  return validState(await readJson(dir, STATE))
}

function writeState(dir: DirHandle, state: OfflineState): Promise<void> {
  return writeJson(dir, STATE, state)
}

/** Без `meta.json` — недописанная постановка, её не видно. */
async function readItem(id: string, known?: DirHandle): Promise<OfflineItem | null> {
  const dir = known ?? (await itemDir(id))
  if (!dir) return null
  const meta = await readMeta(dir)
  if (!meta) return null
  let state = await readState(dir)
  if (!state) {
    const job = await readJob(dir)
    state = fallbackState(await fileSize(dir, VIDEO), await fileSize(dir, PART), job?.size ?? 0)
  }
  return { id, meta: meta as unknown as OfflineMeta, state }
}

async function listItems(): Promise<OfflineItem[]> {
  const root = await offlineRoot()
  const items: OfflineItem[] = []
  for (const entry of await entries(root)) {
    if (entry.kind !== 'directory' || !validId(entry.name)) continue
    const item = await readItem(entry.name, entry as DirHandle).catch(() => null)
    if (item) items.push(item)
  }
  return items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Готовый ролик: `video.mp4`, а без `move()` — `video.mp4.part` с `done`. */
async function videoHandle(dir: DirHandle): Promise<FileHandle | null> {
  const video = await fileHandle(dir, VIDEO)
  if (video) return video
  const state = await readState(dir)
  return state?.status === 'done' ? fileHandle(dir, PART) : null
}

/** `video.mp4.part` → `video.mp4`, где браузер умеет. Нет — остаётся `.part`. */
async function finalizeVideo(dir: DirHandle, part: FileHandle): Promise<void> {
  if (typeof part.move !== 'function') return
  try {
    await part.move(dir, VIDEO)
    return
  } catch {
    /* старая подпись — ниже */
  }
  try {
    await part.move(VIDEO)
  } catch (e) {
    log.info('rename unsupported, keeping .part', nameOf(e))
  }
}

// --- Замки между вкладками -------------------------------------------------

interface Held {
  release(): void
}

const FREE: Held = { release: () => {} }

function locks(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
}

/** Взять замок ролика, если он свободен; null — его держит другая вкладка. */
function tryLock(id: string): Promise<Held | null> {
  const manager = locks()
  if (!manager) return Promise.resolve(FREE)
  return new Promise<Held | null>((resolve, reject) => {
    manager
      .request(LOCK_PREFIX + id, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null)
          return undefined
        }
        return new Promise<void>((release) => {
          let done = false
          resolve({
            release: () => {
              if (done) return
              done = true
              release()
            },
          })
        })
      })
      .catch(reject)
  })
}

const waiting = new Set<string>()

/** Ролик качает другая вкладка: когда отпустит — показать итог и, если надо, продолжить. */
function waitForOtherTab(id: string): void {
  const manager = locks()
  if (!manager || waiting.has(id)) return
  waiting.add(id)
  manager
    .request(LOCK_PREFIX + id, async () => {
      waiting.delete(id)
      const dir = await itemDir(id).catch(() => null)
      const state = dir ? await serial(() => readState(dir)) : null
      if (state && (state.status === 'queued' || state.status === 'downloading')) {
        if (!queue.includes(id) && !running.has(id)) queue.push(id)
      }
      await emitChanged(id)
    })
    .then(pump, () => waiting.delete(id))
}

// --- Очередь -----------------------------------------------------------------

let queue: string[] = []
const running = new Map<string, StopSignal>()
/** Состояние идущих загрузок — для `usage`, пока `.part` занят записью. */
const live = new Map<string, OfflineState>()

async function emitChanged(id: string): Promise<void> {
  const item = await serial(() => readItem(id)).catch(() => null)
  post({ event: 'changed', data: { id, item } })
}

/** Запустить ждущие, пока есть свободные места. */
function pump(): void {
  while (running.size < PARALLEL && queue.length) {
    const id = queue.shift() as string
    if (running.has(id)) continue
    const stop = new StopSignal()
    running.set(id, stop)
    void runTask(id, stop)
  }
}

/** Сколько свободно для сайта; null — не узнать. */
async function freeBytes(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate || typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number') {
      return null
    }
    return Math.max(0, estimate.quota - estimate.usage)
  } catch {
    return null
  }
}

const httpFetch: HttpFetch = (url, init) =>
  fetch(url, {
    headers: init.headers,
    signal: init.signal,
    mode: 'cors',
    credentials: 'omit',
    // Ролик ложится в OPFS — второй копии в HTTP-кэше не нужно.
    cache: 'no-store',
  })

function syncFile(h: SyncHandle): DownloadFile {
  return {
    size: async () => Number(await h.getSize()),
    write: async (at, data) => writeAll(h, at, data),
    truncate: async (len) => {
      await h.truncate(len)
    },
    flush: async () => {
      await h.flush()
    },
  }
}

/** Скачать ролик в его папку (как `download::run` в Rust). */
async function download(
  id: string,
  dir: DirHandle,
  job: OfflineJob,
  state: OfflineState,
  stop: StopSignal
): Promise<void> {
  throwIfStopped(stop)
  if (await fileHandle(dir, VIDEO)) return
  await fetchExtras({
    fetch: httpFetch,
    extras: job.extras,
    stop,
    exists: async (name) => (await fileSize(dir, name)) !== null,
    write: async (name, bytes) => {
      try {
        await writeBytes(dir, name, bytes)
      } catch (e) {
        // Недописанная обложка хуже никакой: в следующий раз скачается снова.
        await removeFile(dir, name)
        throw e
      }
    },
    log: (msg) => log.info(id, msg),
  })
  const hashes = await loadHashes({
    fetch: httpFetch,
    urls: job.sha256Urls,
    fileName: job.fileName,
    stop,
    saved: () => readText(dir, HASHES),
    save: (text) => writeBytes(dir, HASHES, encoder.encode(text)),
    log: (msg) => log.info(id, msg),
  })

  const part = await fileHandle(dir, PART, true)
  if (!part) throw new DlError('io', 'no part file')
  const handle = await openSync(part)
  const progress = throttle(PROGRESS_EVERY_MS)
  live.set(id, state)
  try {
    await downloadFile({
      sources: job.sources,
      size: job.size,
      state,
      file: syncFile(handle),
      hashes,
      fetch: httpFetch,
      policy,
      stop,
      free: freeBytes,
      report: async (s, persist) => {
        if (persist) {
          await serial(() => writeState(dir, s)).catch((e: unknown) => {
            log.warn(id, 'state not saved', nameOf(e))
          })
        }
        if (progress()) {
          post({ event: 'progress', data: { id, received: s.received, total: s.total } })
        }
      },
    })
    await handle.flush()
  } finally {
    live.delete(id)
    await Promise.resolve(handle.close()).catch(() => {})
  }
  await finalizeVideo(dir, part)
  await removeFile(dir, HASHES)
}

type Begun =
  | { kind: 'run'; dir: DirHandle; job: OfflineJob; state: OfflineState }
  | { kind: 'fail'; state: OfflineState }
  | { kind: 'skip' }

/** Перед загрузкой: ждёт ли ролик ещё, есть ли задание. */
async function begin(id: string): Promise<Begun> {
  const dir = await itemDir(id)
  if (!dir) return { kind: 'skip' }
  const state = await readState(dir)
  if (!state || (state.status !== 'queued' && state.status !== 'downloading')) {
    return { kind: 'skip' }
  }
  const job = await readJob(dir)
  if (!job) return { kind: 'fail', state }
  state.status = 'downloading'
  delete state.error
  await writeState(dir, state)
  return { kind: 'run', dir, job, state }
}

/** Итог — по одному с командами: «удалить» либо дошло до задачи, либо удаляет само. */
async function finish(
  id: string,
  stop: StopSignal,
  held: Held,
  state: OfflineState | null,
  failure: { error: unknown } | null
): Promise<boolean> {
  running.delete(id)
  try {
    if (stop.reason === 'remove') {
      const root = await offlineRoot()
      await root.removeEntry(id, { recursive: true }).catch((e: unknown) => {
        log.warn(id, 'remove failed', nameOf(e))
      })
      return true
    }
    if (!state) return false
    const next = finishState(state, failure)
    const dir = await itemDir(id)
    // Не записалось — страница всё равно узнает, что загрузка встала.
    if (dir) await writeState(dir, next).catch((e: unknown) => log.warn(id, 'state', nameOf(e)))
    return true
  } finally {
    held.release()
  }
}

async function runTask(id: string, stop: StopSignal): Promise<void> {
  let held: Held | null = null
  let changed = false
  try {
    held = await tryLock(id)
    if (!held) {
      await serial(async () => {
        running.delete(id)
      })
      waitForOtherTab(id)
      return
    }
    const lock = held
    const begun = await serial(() => begin(id)).catch((e: unknown): Begun => {
      log.warn(id, 'cannot start', nameOf(e))
      return { kind: 'skip' }
    })
    let state: OfflineState | null = null
    let failure: { error: unknown } | null = null
    if (begun.kind === 'run') {
      state = begun.state
      await emitChanged(id)
      try {
        await download(id, begun.dir, begun.job, state, stop)
      } catch (e) {
        if (!(e instanceof DlError && e.code === 'stopped')) log.warn(id, String(e))
        failure = { error: e }
      }
    } else if (begun.kind === 'fail') {
      state = begun.state
      failure = { error: new DlError('io', 'no job') }
    }
    changed = await serial(() => finish(id, stop, lock, state, failure))
    // Ждать уже нечего (докачала другая вкладка, удалили) — показать, что на диске.
    if (begun.kind === 'skip') changed = true
  } catch (e) {
    log.warn(id, 'task failed', String(e))
    running.delete(id)
  } finally {
    held?.release()
    if (changed) await emitChanged(id)
    pump()
  }
}

// --- Команды -----------------------------------------------------------------

/** Поставить в очередь. Уже есть — вернуть как есть (аккаунт допишет страница). */
async function enqueue(rawJob: unknown, rawMeta: unknown): Promise<OfflineItem> {
  const job = validateJob(rawJob)
  if (!isObject(rawMeta)) throw new Error('invalid_meta')
  const existing = await readItem(job.id)
  if (existing) return existing
  const dir = await itemDir(job.id, true)
  if (!dir) throw new Error('invalid_id')
  await writeJson(dir, JOB, job)
  await writeState(dir, { status: 'queued', received: 0, total: job.size })
  // meta.json последним: без него папку не видно в списке.
  await writeJson(dir, META, { ...rawMeta, id: job.id })
  if (!queue.includes(job.id)) queue.push(job.id)
  const item = await readItem(job.id, dir)
  if (!item) throw new Error('io')
  return item
}

/** true — состояние на диске поменялось. */
async function pause(id: string): Promise<boolean> {
  if (!validId(id)) throw new Error('invalid_id')
  const stop = running.get(id)
  if (stop) {
    stop.stop('pause')
    return false
  }
  queue = queue.filter((q) => q !== id)
  const dir = await itemDir(id)
  const state = dir ? await readState(dir) : null
  if (!dir || !state || (state.status !== 'queued' && state.status !== 'downloading')) {
    return false
  }
  // «Качается», а здесь не идёт — качает другая вкладка, отсюда её загрузку не
  // остановить. Замок свободен — та вкладка закрылась посреди загрузки, и ролик
  // ставится на паузу здесь, как ждущий.
  const held = state.status === 'downloading' ? await tryLock(id) : FREE
  if (!held) {
    waitForOtherTab(id)
    throw new Error('busy')
  }
  try {
    state.status = 'paused'
    delete state.error
    await writeState(dir, state)
    return true
  } finally {
    held.release()
  }
}

/** Продолжить приостановленное или упавшее (кнопка «Повторить»). */
async function resume(id: string): Promise<boolean> {
  if (!validId(id)) throw new Error('invalid_id')
  if (running.has(id) || queue.includes(id)) return false
  const dir = await itemDir(id)
  // state.json потерялся — то же, что показывает список (`failed`/`io` с тем, что на диске).
  const state = dir ? ((await readState(dir)) ?? (await readItem(id, dir))?.state) : null
  if (!dir || !state) throw new Error('not_found')
  if (state.status === 'done') return false
  state.status = 'queued'
  delete state.error
  await writeState(dir, state)
  queue.push(id)
  return true
}

/** true — папка удалена сейчас; false — удалит идущая загрузка (или нечего). */
async function remove(id: string): Promise<boolean> {
  if (!validId(id)) throw new Error('invalid_id')
  const stop = running.get(id)
  if (stop) {
    stop.stop('remove')
    return false
  }
  queue = queue.filter((q) => q !== id)
  const held = await tryLock(id)
  if (!held) {
    waitForOtherTab(id)
    throw new Error('busy')
  }
  try {
    const root = await offlineRoot()
    await root.removeEntry(id, { recursive: true })
    return true
  } catch (e) {
    if (nameOf(e) === 'NotFoundError') return false
    throw e
  } finally {
    held.release()
  }
}

async function patch(id: string, fields: unknown): Promise<OfflineItem> {
  if (!validId(id)) throw new Error('invalid_id')
  const dir = await itemDir(id)
  const meta = dir ? await readMeta(dir) : null
  if (!dir || !meta) throw new Error('not_found')
  await writeJson(dir, META, patchMeta(meta, fields))
  const item = await readItem(id, dir)
  if (!item) throw new Error('not_found')
  return item
}

async function dirSize(dir: DirHandle, id: string | null): Promise<number> {
  let sum = 0
  for (const entry of await entries(dir).catch(() => [])) {
    if (entry.kind === 'directory') {
      sum += await dirSize(entry as DirHandle, id ?? entry.name)
      continue
    }
    try {
      sum += (await (entry as FileHandle).getFile()).size
    } catch {
      // `.part` занят записью — берём, сколько скачано.
      if (id && entry.name === PART) sum += live.get(id)?.received ?? 0
    }
  }
  return sum
}

async function usage(): Promise<OfflineUsage> {
  const root = await offlineRoot()
  return { used: await dirSize(root, null), free: await freeBytes() }
}

async function file(id: string, name: OfflineFile): Promise<File> {
  if (!validId(id) || !(name === VIDEO || validExtraName(name))) throw new Error('invalid_file')
  const dir = await itemDir(id)
  if (!dir) throw new Error('not_found')
  const fh = name === VIDEO ? await videoHandle(dir) : await fileHandle(dir, name)
  if (!fh) throw new Error('not_found')
  return fh.getFile()
}

async function clear(): Promise<void> {
  const ids = (await serial(listItems)).map((i) => i.id)
  let busy = false
  for (const id of ids) {
    const removed = await serial(() => remove(id)).catch((e: unknown) => {
      if (e instanceof Error && e.message === 'busy') busy = true
      else throw e
      return false
    })
    if (removed) await emitChanged(id)
  }
  if (busy) throw new Error('busy')
}

function setPolicy(next: Partial<Policy>): void {
  policy = {
    chunk: next.chunk && next.chunk > 0 ? next.chunk : policy.chunk,
    retryDelays: Array.isArray(next.retryDelays) ? next.retryDelays : policy.retryDelays,
    stallMs: next.stallMs && next.stallMs > 0 ? next.stallMs : policy.stallMs,
  }
}

async function dispatch(call: WorkerCall): Promise<unknown> {
  await ready
  switch (call.op) {
    case 'list':
      return serial(listItems)
    case 'enqueue': {
      const item = await serial(() => enqueue(call.job, call.meta))
      await emitChanged(item.id)
      pump()
      return item
    }
    case 'pause':
      if (await serial(() => pause(call.id))) await emitChanged(call.id)
      return null
    case 'resume':
      if (await serial(() => resume(call.id))) {
        await emitChanged(call.id)
        pump()
      }
      return null
    case 'remove':
      if (await serial(() => remove(call.id))) await emitChanged(call.id)
      return null
    case 'patchMeta': {
      const item = await serial(() => patch(call.id, call.patch))
      await emitChanged(call.id)
      return item
    }
    case 'usage':
      return usage()
    case 'clear':
      await clear()
      return null
    case 'file':
      return serial(() => file(call.id, call.file))
    case 'policy':
      setPolicy(call.policy)
      return null
  }
}

/** Код для страницы: свои коды как есть, место — `disk_full`, прочее — `io`. */
function errorCode(e: unknown): string {
  if (e instanceof DlError) return e.code
  if (isQuotaError(e)) return 'disk_full'
  if (e instanceof Error && /^[a-z_]+$/.test(e.message)) return e.message
  return 'io'
}

// --- Запуск ------------------------------------------------------------------

/** Качалось или ждало при закрытии вкладки — продолжим. */
async function init(): Promise<void> {
  for (const item of await listItems()) {
    const { status } = item.state
    if (status !== 'queued' && status !== 'downloading') continue
    if (status === 'downloading') {
      // Не качает ли его другая вкладка прямо сейчас.
      const held = await tryLock(item.id)
      if (held) {
        try {
          const dir = await itemDir(item.id)
          if (dir) await writeState(dir, { ...item.state, status: 'queued' })
        } finally {
          held.release()
        }
      }
    }
    if (!queue.includes(item.id)) queue.push(item.id)
  }
}

const ready = serial(init).catch((e: unknown) => {
  log.warn('init failed', nameOf(e) || String(e))
})

void ready.then(() => setTimeout(pump, RESUME_AFTER_MS))

scope.addEventListener('message', (e) => {
  const req = e.data
  if (!req || typeof req.rid !== 'number') return
  dispatch(req).then(
    (value) => post({ rid: req.rid, ok: true, value }),
    (err: unknown) => {
      const error = errorCode(err)
      if (error === 'io') log.warn(req.op, nameOf(err) || String(err))
      post({ rid: req.rid, ok: false, error })
    }
  )
})
