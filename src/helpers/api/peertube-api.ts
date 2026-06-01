// Сетевой слой PeerTube API: получение информации о видео с retry+timeout.

import { appFetch } from '@/helpers/api/request'

/** Информация о видео с PeerTube сервера (минимально необходимая для плеера). */
export interface PeerTubeVideoInfo {
  id: number
  uuid: string
  name: string
  description?: string
  thumbnailPath?: string
  previewPath?: string
  thumbnailUrl?: string
  previewUrl?: string
  streamingPlaylists?: Array<{
    id: number
    playlistUrl: string
    segmentsSha256Url?: string
    files?: Array<{
      resolution?: { id: number; label: string }
      fileUrl?: string
      size?: number
    }>
  }>
  files?: Array<{
    resolution?: { id: number; label: string }
    fileUrl?: string
    size?: number
  }>
}

const PEERTUBE_FETCH_TIMEOUT_MS = 10_000
const PEERTUBE_MAX_RETRIES = 3
const PEERTUBE_RETRY_BASE_DELAY_MS = 500

/**
 * Классификация причины сбоя загрузки видео-инфо — чтобы UI мог показать
 * разное сообщение для "ноды нет / CORS" и обычной сетевой ошибки.
 * - not-found: 404, видео отсутствует на ноде (не ретраится).
 * - http-error: нода ответила не-2xx (5xx и т.п.).
 * - timeout: истёк AbortController-таймаут.
 * - cors-or-network: браузерный fetch не дошёл до ответа. В production это прямой
 *   кросс-origin запрос, и чаще всего нода просто не настроена на CORS (либо недоступна) —
 *   браузер по дизайну не различает эти два случая, отдаёт один `TypeError: Failed to fetch`.
 * - unknown: всё остальное.
 */
export type PeerTubeFetchErrorCode =
  | 'not-found'
  | 'http-error'
  | 'timeout'
  | 'cors-or-network'
  | 'unknown'

/** Ошибка загрузки PeerTube-инфо с машиночитаемым `code` для выбора сообщения в UI. */
export class PeerTubeFetchError extends Error {
  constructor(
    message: string,
    public readonly code: PeerTubeFetchErrorCode,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'PeerTubeFetchError'
  }
}

/** Свести произвольную ошибку fetch к нашему коду. `isDevBrowser` — идём ли через Vite-прокси. */
function classifyFetchError(err: Error, isDevBrowser: boolean): PeerTubeFetchErrorCode {
  if (err instanceof PeerTubeFetchError) return err.code
  if (err.name === 'AbortError') return 'timeout'
  // В dev запрос идёт через same-origin Vite-прокси, поэтому CORS неприменим — это просто сеть.
  if (err instanceof TypeError && !isDevBrowser) return 'cors-or-network'
  return 'unknown'
}

/** Одна попытка fetch с таймаутом через AbortController. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await appFetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Получает информацию о видео через PeerTube API. До 3 попыток с экспоненциальным
 * backoff (500ms / 1s / 2s) и таймаутом 10s на каждую. 404 не ретраится.
 *
 * В dev в браузере — через Vite proxy для обхода CORS.
 */
export async function getPeerTubeVideoInfo(
  host: string,
  videoId: string
): Promise<PeerTubeVideoInfo> {
  if (!host || !videoId) throw new Error('Host and videoId are required')

  const isDevBrowser =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined'
  const apiUrl = isDevBrowser
    ? `/api/peertube/${host}/api/v1/videos/${videoId}`
    : `https://${host}/api/v1/videos/${videoId}`

  const init: RequestInit = {
    method: 'GET',
    // PeerTube часто отдаёт 302 при балансировке — следуем за редиректом явно, не полагаясь на дефолт.
    redirect: 'follow',
    headers: {
      Accept: 'application/json',
      Referer: typeof window !== 'undefined' ? window.location.origin : '',
    },
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < PEERTUBE_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(apiUrl, init, PEERTUBE_FETCH_TIMEOUT_MS)

      if (response.status === 404) {
        throw new PeerTubeFetchError(`Video not found: ${videoId}`, 'not-found')
      }
      if (!response.ok) {
        throw new PeerTubeFetchError(
          `Failed to fetch video info: ${response.status} ${response.statusText}`,
          'http-error'
        )
      }
      const data = await response.json()
      return data as PeerTubeVideoInfo
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error))

      // 404 — окончательный ответ, не ретраим.
      if (err instanceof PeerTubeFetchError && err.code === 'not-found') throw err

      lastError = err
      const isLastAttempt = attempt === PEERTUBE_MAX_RETRIES - 1
      if (isLastAttempt) break

      const delay = PEERTUBE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  const code = lastError ? classifyFetchError(lastError, isDevBrowser) : 'unknown'
  throw new PeerTubeFetchError(
    lastError?.message ?? 'peertube fetch failed: unknown error',
    code,
    lastError ?? undefined
  )
}
