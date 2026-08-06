/**
 * Фаза C — транспорт загрузки видео на PeerTube-инстанс (resumable, uploadx/Google).
 *
 * Порт из pocketnet.gui/js/peertube.js:799-980 + js/video-uploader.js. Всё идёт
 * НАПРЯМУЮ браузер → инстанс через appFetch (Tor / Tauri plugin-http / dev vite-proxy):
 *   1) POST api/v1/videos/upload-resumable          (multipart, ТОЛЬКО метаданные)
 *        + заголовки X-Upload-Content-Length / X-Upload-Content-Type, Bearer
 *        → upload_id из заголовка Location
 *   2) PUT  api/v1/videos/upload-resumable?upload_id=…   (тело = сырые байты чанка)
 *        Content-Type: application/octet-stream, Content-Range: bytes s-e/total
 *        308 = продолжать · 200 = готово (video.uuid) · 404 = реинициализировать
 *        403/409/413/415/422/429/503 = ошибка
 *   3) DELETE api/v1/videos/upload-resumable?upload_id=…  (отмена)
 *
 * Отличия от оригинала (осознанно):
 * - Транспорт — appFetch, а НЕ axios (Tor/Tauri CORS). §3 чеклиста: стриминг PUT и
 *   чтение Location под torFetch/plugin-http — самый рискованный пункт, проверяется вживую.
 * - Размер чанка — вменяемый (кратный 256), а не legacy 256 Б/чанк.
 * - Retry — экспонента с cap вместо наивных фиксированных 2 с; на каждый чанк — таймаут+AbortController.
 */

import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'

/** Приватность PUBLIC в терминах PeerTube. */
const PUBLIC_PRIVACY = 1
/** Выравнивание чанка (все кроме последнего) — требование uploadx-протокола. */
const CHUNK_ALIGNMENT = 256
/** Дефолтный размер чанка: 2 МиБ, кратно 256. Не legacy 256 Б. */
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024
/** Максимум попыток PUT одного чанка при сетевой/временной ошибке. */
const MAX_CHUNK_ATTEMPTS = 5
/** База и потолок экспоненциального backoff между попытками. */
const RETRY_BASE_MS = 1000
const RETRY_CAP_MS = 15000
/** Таймаут на один PUT-чанк (в оригинале таймаутов нет вовсе). */
const CHUNK_TIMEOUT_MS = 60000
/** Сколько раз готовы переинициализировать upload при 404. */
const MAX_REINITS = 2
/** TTL resume-состояния — возобновляем незавершённую загрузку в пределах 12 ч. */
const RESUME_TTL_MS = 12 * 60 * 60 * 1000

/** Ошибка транспорта. `cancelled` — пользователь прервал; `status` — HTTP-код инстанса. */
export class PeertubeUploadError extends Error {
  status?: number
  cancelled: boolean
  constructor(message: string, opts: { status?: number; cancelled?: boolean } = {}) {
    super(message)
    this.name = 'PeertubeUploadError'
    this.status = opts.status
    this.cancelled = !!opts.cancelled
  }
}

/** Метаданные создаваемого видео (init-форма). Обогащается в Фазе E. */
export interface UploadMetadata {
  channelId: number
  name: string
  /** Служебное имя файла на инстансе; по умолчанию = name. */
  filename?: string
  /** По умолчанию PUBLIC (1). */
  privacy?: number
  /** ISO-время отложенного апдейта; по умолчанию — «сейчас». */
  scheduleUpdateAt?: string
  /** Кастомная обложка — уходит и в thumbnailfile, и в previewfile. */
  thumbnailFile?: File
}

/** Прогресс загрузки байтов. */
export interface UploadProgress {
  bytesUploaded: number
  total: number
  percent: number
}

/** Итог загрузки: истинный host (мог смениться mid-flow) + идентификаторы видео. */
export interface UploadVideoResult {
  host: string
  uuid: string
  isAudio: boolean
}

/** Resume-состояние в localStorage (ключ = host+address+videoKey). */
interface ResumableState {
  uploadHost: string
  uploadId: string
  resumeFrom: number
  lastOperation: number
}

// ── утилиты ───────────────────────────────────────────────────────────────────

const defaultNow = (): number => Date.now()
const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Округляет размер чанка вниз до кратности 256; при вырождении — дефолт. */
function alignChunkSize(size: number): number {
  const aligned = Math.floor(size / CHUNK_ALIGNMENT) * CHUNK_ALIGNMENT
  return aligned >= CHUNK_ALIGNMENT ? aligned : DEFAULT_CHUNK_SIZE
}

/** backoff attempt-й попытки: base·2^attempt, но не выше cap. */
function backoffMs(attempt: number): number {
  return Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** attempt)
}

/**
 * Достаёт upload_id из заголовка Location. Поддерживает абсолютный URL,
 * относительный путь и «host/path?…» (как в оригинале `http://`+location).
 * Возвращает null, если заголовок не пришёл (в браузере — вероятная CORS-проблема:
 * инстанс не экспонировал Location через Access-Control-Expose-Headers).
 */
export function parseUploadId(location: string | null | undefined): string | null {
  if (!location) return null
  try {
    const url = /^https?:\/\//i.test(location)
      ? new URL(location)
      : new URL(location, 'http://placeholder.invalid')
    const id = url.searchParams.get('upload_id')
    if (id) return id
  } catch {
    // ниже — регэксп-фолбэк на «host/path?upload_id=…» без схемы.
  }
  const m = location.match(/upload_id=([^&]+)/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

/** Ключ resume-состояния — как в оригинале: `resumable_${host}_${address}_${videoKey}`. */
export function resumableStorageKey(host: string, address: string, videoKey: string): string {
  return `resumable_${host}_${address}_${videoKey}`
}

/** Стабильный ключ файла без хеширования содержимого (достаточно для resume в сессии). */
function defaultVideoKey(file: File): string {
  const lastModified = typeof file.lastModified === 'number' ? file.lastModified : 0
  return `${file.name}_${file.size}_${lastModified}`
}

function loadResumableState(key: string, now: number): ResumableState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<ResumableState>
    if (!s?.uploadId || typeof s.resumeFrom !== 'number' || typeof s.lastOperation !== 'number') {
      return null
    }
    if (now - s.lastOperation > RESUME_TTL_MS) return null // протух — заставим переинициализировать
    return s as ResumableState
  } catch {
    return null
  }
}

function saveResumableState(key: string, state: ResumableState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // недоступность storage не критична — просто не сможем возобновить.
  }
}

function clearResumableState(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

function isCancelled(e: unknown): boolean {
  return (
    (e instanceof PeertubeUploadError && e.cancelled) ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

// ── init / chunk / cancel ──────────────────────────────────────────────────────

/** Собирает multipart-форму init-запроса — только метаданные, без байтов видео. */
function buildInitFormData(metadata: UploadMetadata, now: number): FormData {
  const fd = new FormData()
  fd.append('privacy', String(metadata.privacy ?? PUBLIC_PRIVACY))
  fd.append('scheduleUpdate[updateAt]', metadata.scheduleUpdateAt ?? new Date(now).toISOString())
  fd.append('channelId', String(metadata.channelId))
  fd.append('name', metadata.name)
  fd.append('filename', metadata.filename ?? metadata.name)
  if (metadata.thumbnailFile) {
    fd.append('thumbnailfile', metadata.thumbnailFile)
    fd.append('previewfile', metadata.thumbnailFile)
  }
  return fd
}

export interface InitResumableParams {
  fetchInstance: InstanceFetch
  accessToken: string
  size: number
  contentType: string
  metadata: UploadMetadata
  now?: () => number
}

/**
 * Инициализирует resumable-загрузку. Возвращает upload_id.
 * 413 → велик/квота, 415 → неподдерживаемый тип, нет Location → вероятно CORS.
 */
export async function initResumableUpload(params: InitResumableParams): Promise<string> {
  const { fetchInstance, accessToken, size, contentType, metadata } = params
  const now = (params.now ?? defaultNow)()

  const res = await fetchInstance('api/v1/videos/upload-resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Upload-Content-Length': String(size),
      'X-Upload-Content-Type': contentType,
    },
    body: buildInitFormData(metadata, now),
  })

  if (res.status === 413) {
    throw new PeertubeUploadError('peertube_upload_too_large', { status: 413 })
  }
  if (res.status === 415) {
    throw new PeertubeUploadError('peertube_upload_unsupported_type', { status: 415 })
  }
  if (res.status !== 200 && res.status !== 201) {
    throw new PeertubeUploadError(`peertube_init_${res.status}`, { status: res.status })
  }

  const location = res.headers.get('Location') ?? res.headers.get('location')
  const uploadId = parseUploadId(location)
  if (!uploadId) throw new PeertubeUploadError('peertube_no_location')
  return uploadId
}

/** Результат PUT одного чанка — либо ветвь состояния, либо финал. */
type ChunkOutcome =
  | { kind: 'resume' }
  | { kind: 'not_found' }
  | { kind: 'done'; uuid: string; isAudio: boolean; host: string }

/** Извлекает истинный host из `data.video.videoCreated.url` (исходный мог быть архивирован). */
function extractTrueHost(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    return new URL(url).host || fallback
  } catch {
    return fallback
  }
}

interface PutChunkParams {
  fetchInstance: InstanceFetch
  accessToken: string
  uploadId: string
  /** Сырые байты чанка. ArrayBuffer (не Uint8Array) — чистый BodyInit и совместим с plugin-http. */
  bytes: ArrayBuffer
  start: number
  total: number
  host: string
  signal?: AbortSignal
}

/** Один PUT-чанк (без retry). Таймаут + линковка к внешнему signal через свой AbortController. */
async function putChunkOnce(p: PutChunkParams): Promise<ChunkOutcome> {
  const end = p.start + p.bytes.byteLength - 1
  const ctrl = new AbortController()
  const onAbort = (): void => ctrl.abort()
  p.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctrl.abort(), CHUNK_TIMEOUT_MS)

  let res: Response
  try {
    res = await p.fetchInstance(
      `api/v1/videos/upload-resumable?upload_id=${encodeURIComponent(p.uploadId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${p.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${p.start}-${end}/${p.total}`,
        },
        body: p.bytes,
        signal: ctrl.signal,
      }
    )
  } finally {
    clearTimeout(timer)
    p.signal?.removeEventListener('abort', onAbort)
  }

  switch (res.status) {
    case 308:
      return { kind: 'resume' }
    case 404:
      return { kind: 'not_found' }
    case 200: {
      const j = (await res.json().catch(() => null)) as {
        video?: { uuid?: string; isAudio?: boolean; videoCreated?: { url?: string } }
      } | null
      const video = j?.video
      if (!video?.uuid) throw new PeertubeUploadError('peertube_upload_no_uuid', { status: 200 })
      return {
        kind: 'done',
        uuid: video.uuid,
        isAudio: !!video.isAudio,
        host: extractTrueHost(video.videoCreated?.url, p.host),
      }
    }
    // временные — стоит повторить
    case 429:
    case 503:
      throw new PeertubeUploadError(`peertube_chunk_retryable_${res.status}`, {
        status: res.status,
      })
    // жёсткие — повтор бессмыслен
    case 403:
    case 409:
    case 413:
    case 415:
    case 422:
      throw new PeertubeUploadError(`peertube_chunk_${res.status}`, { status: res.status })
    default:
      throw new PeertubeUploadError(`peertube_chunk_${res.status}`, { status: res.status })
  }
}

/** PUT-чанк с retry: сетевые сбои и 429/503 — экспонента+cap; жёсткие коды — сразу наверх. */
async function putChunkWithRetry(
  p: PutChunkParams,
  sleep: (ms: number) => Promise<void>
): Promise<ChunkOutcome> {
  for (let attempt = 0; ; attempt++) {
    if (p.signal?.aborted)
      throw new PeertubeUploadError('peertube_upload_cancelled', { cancelled: true })
    try {
      return await putChunkOnce(p)
    } catch (e) {
      if (p.signal?.aborted || (e instanceof Error && e.name === 'AbortError')) {
        throw new PeertubeUploadError('peertube_upload_cancelled', { cancelled: true })
      }
      const retryable =
        !(e instanceof PeertubeUploadError) || // сетевой сбой fetch (не наша ошибка кода)
        e.status === 429 ||
        e.status === 503
      if (!retryable || attempt >= MAX_CHUNK_ATTEMPTS - 1) throw e
      await sleep(backoffMs(attempt))
    }
  }
}

/** Отмена на инстансе (best-effort): DELETE upload-resumable?upload_id=. */
async function cancelRemote(
  fetchInstance: InstanceFetch,
  accessToken: string,
  uploadId: string
): Promise<void> {
  await fetchInstance(`api/v1/videos/upload-resumable?upload_id=${encodeURIComponent(uploadId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {
    // отмена — best-effort, ошибку глушим.
  })
}

// ── оркестратор ────────────────────────────────────────────────────────────────

export interface UploadVideoParams {
  host: string
  address: string
  accessToken: string
  file: File
  metadata: UploadMetadata
  /** Ключ для resume-персиста; по умолчанию из имени+размера+mtime. */
  videoKey?: string
  /** Размер чанка (будет выровнен вниз до 256). */
  chunkSize?: number
  /** Внешняя отмена. */
  signal?: AbortSignal
  onProgress?: (p: UploadProgress) => void
  // DI для тестов:
  fetchInstance?: InstanceFetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

/**
 * Загружает файл на инстанс resumable-протоколом. Возобновляет прерванную загрузку
 * из localStorage (<12 ч), реинициализируется на 404, отменяется по signal (DELETE),
 * держит истинный host на финале. Кидает PeertubeUploadError (в т.ч. cancelled:true).
 */
export async function uploadVideoResumable(params: UploadVideoParams): Promise<UploadVideoResult> {
  const { host, address, accessToken, file, metadata } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))
  const now = params.now ?? defaultNow
  const sleep = params.sleep ?? defaultSleep
  const chunkSize = alignChunkSize(params.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const total = file.size
  const contentType = file.type || 'application/octet-stream'
  const key = resumableStorageKey(host, address, params.videoKey ?? defaultVideoKey(file))

  const emit = (bytesUploaded: number): void =>
    params.onProgress?.({
      bytesUploaded,
      total,
      percent: total > 0 ? Math.floor((bytesUploaded / total) * 100) : 0,
    })

  const throwIfAborted = (): void => {
    if (params.signal?.aborted) {
      throw new PeertubeUploadError('peertube_upload_cancelled', { cancelled: true })
    }
  }

  if (total <= 0) throw new PeertubeUploadError('peertube_empty_file')
  throwIfAborted()

  const init = async (): Promise<string> =>
    initResumableUpload({
      fetchInstance,
      accessToken,
      size: total,
      contentType,
      metadata,
      now,
    })

  // Возобновление либо свежий init.
  const cached = loadResumableState(key, now())
  let uploadId: string
  let pos: number
  if (cached) {
    uploadId = cached.uploadId
    pos = cached.resumeFrom
  } else {
    uploadId = await init()
    pos = 0
    saveResumableState(key, { uploadHost: host, uploadId, resumeFrom: 0, lastOperation: now() })
  }

  let reinits = 0

  try {
    while (pos < total) {
      throwIfAborted()

      const end = Math.min(pos + chunkSize, total)
      const bytes = await file.slice(pos, end).arrayBuffer()

      const outcome = await putChunkWithRetry(
        {
          fetchInstance,
          accessToken,
          uploadId,
          bytes,
          start: pos,
          total,
          host,
          signal: params.signal,
        },
        sleep
      )

      if (outcome.kind === 'not_found') {
        if (reinits >= MAX_REINITS)
          throw new PeertubeUploadError('peertube_upload_reinit_exhausted')
        reinits += 1
        clearResumableState(key)
        uploadId = await init()
        pos = 0
        saveResumableState(key, { uploadHost: host, uploadId, resumeFrom: 0, lastOperation: now() })
        continue
      }

      if (outcome.kind === 'done') {
        clearResumableState(key)
        emit(total)
        return { host: outcome.host || host, uuid: outcome.uuid, isAudio: outcome.isAudio }
      }

      // 308 — чанк принят, двигаемся дальше.
      pos = end
      saveResumableState(key, { uploadHost: host, uploadId, resumeFrom: pos, lastOperation: now() })
      emit(pos)
    }

    // Дошли до конца без финального 200 — инстанс не подтвердил создание видео.
    throw new PeertubeUploadError('peertube_upload_incomplete')
  } catch (e) {
    if (isCancelled(e)) {
      await cancelRemote(fetchInstance, accessToken, uploadId)
      clearResumableState(key)
      throw e instanceof PeertubeUploadError
        ? e
        : new PeertubeUploadError('peertube_upload_cancelled', { cancelled: true })
    }
    // Не отмена: resume-состояние сохранено на последнем успешном чанке — оставляем для повтора.
    throw e
  }
}
