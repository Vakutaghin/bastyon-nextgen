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
  // videoId — user-controlled: энкодим в path, иначе `../` или query-инъекция
  // уводят запрос на другой эндпоинт/хост (P1-9). Транспорт — appFetch (Tor).
  const encodedId = encodeURIComponent(videoId)
  const apiUrl = isDevBrowser
    ? `/api/peertube/${host}/api/v1/videos/${encodedId}`
    : `https://${host}/api/v1/videos/${encodedId}`

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

/** Дорожка субтитров PeerTube (нормализованная). */
export interface PeerTubeCaption {
  /** Код языка (BCP-47-ish, напр. 'en', 'ru'). */
  language: string
  /** Человекочитаемая метка ('English'). */
  label: string
  /** URL VTT-файла (через dev-proxy / прямой хост) для последующего fetch→blob. */
  url: string
}

/** dev → vite-proxy (same-origin, без CORS), prod → прямой хост. */
function peertubeBase(host: string): string {
  const isDevBrowser =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.DEV === true &&
    typeof window !== 'undefined'
  return isDevBrowser ? `/api/peertube/${host}` : `https://${host}`
}

/**
 * Список субтитров видео (`GET /api/v1/videos/{id}/captions`). Пустой массив, если
 * субтитров нет или эндпоинт недоступен (не критично — видео работает без них).
 */
export async function getPeerTubeCaptions(
  host: string,
  videoId: string
): Promise<PeerTubeCaption[]> {
  if (!host || !videoId) return []
  const base = peertubeBase(host)
  try {
    const response = await fetchWithTimeout(
      `${base}/api/v1/videos/${encodeURIComponent(videoId)}/captions`,
      { method: 'GET', redirect: 'follow', headers: { Accept: 'application/json' } },
      PEERTUBE_FETCH_TIMEOUT_MS
    )
    if (!response.ok) return []
    const json = (await response.json()) as {
      data?: Array<{
        language?: { id?: string; label?: string }
        captionPath?: string
        fileUrl?: string
      }>
    }
    const list = Array.isArray(json?.data) ? json.data : []
    return list
      .map((c) => {
        const language = c.language?.id || ''
        const label = c.language?.label || language
        // Предпочитаем captionPath через base (same-origin в dev); иначе fileUrl.
        // Через URL-конструктор — корректно склеивает относительный путь с base.
        let url = ''
        try {
          if (c.captionPath) {
            url = base.startsWith('http')
              ? new URL(c.captionPath, base).href
              : `${base}${c.captionPath.startsWith('/') ? '' : '/'}${c.captionPath}`
          } else if (c.fileUrl) {
            url = c.fileUrl
          }
        } catch {
          url = c.fileUrl || ''
        }
        return { language, label, url }
      })
      .filter((c) => !!c.url && !!c.language)
  } catch {
    return []
  }
}
