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
        throw new Error(`Video not found: ${videoId}`)
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch video info: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      return data as PeerTubeVideoInfo
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error))

      // 404 — окончательный ответ, не ретраим.
      if (err.message.startsWith('Video not found:')) throw err

      lastError = err
      const isLastAttempt = attempt === PEERTUBE_MAX_RETRIES - 1
      if (isLastAttempt) break

      const delay = PEERTUBE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('peertube fetch failed: unknown error')
}
