// Сетевой слой PeerTube API: получение информации о видео с retry+timeout.

import servers from '@/servers.json'
import { appFetch } from '@/helpers/api/request'
import { orderedProxies } from './node-selector'
import { peertubeArchiveFor } from './peertube-archive'
import type { ServerEndpoint } from './rpc-retry'

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
  /**
   * Нода, которая на самом деле отдала описание: архив или зеркало, если нода
   * из ссылки выведена из работы. От неё считаются относительные пути (превью,
   * субтитры).
   */
  servedBy?: string
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

/** Ответ ноды — действительно описание ролика, а не ошибка в JSON. */
function isVideoInfo(value: unknown): value is PeerTubeVideoInfo & { from?: unknown } {
  if (!value || typeof value !== 'object') return false
  const info = value as Partial<PeerTubeVideoInfo>
  return (
    typeof info.uuid === 'string' &&
    (Array.isArray(info.streamingPlaylists) || Array.isArray(info.files))
  )
}

/** Есть ли что играть: у ролика в обработке ещё нет ни HLS, ни файлов. */
function hasSources(info: PeerTubeVideoInfo): boolean {
  return !!(info.streamingPlaylists?.length || info.files?.length)
}

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i

/**
 * Описание ролика с одной ноды. До 3 попыток с экспоненциальным backoff
 * (500ms / 1s) и таймаутом 10s на каждую. 404 не ретраится. Нода, не
 * ответившая за 10 секунд, второго шанса не получает: дальше — архив или прокси.
 *
 * В dev в браузере — через Vite proxy для обхода CORS.
 */
async function fetchVideoInfoFrom(host: string, videoId: string): Promise<PeerTubeVideoInfo> {
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
      if (isLastAttempt || err.name === 'AbortError') break

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

/**
 * Описание ролика через прокси Bastyon (`/peertube/video`), как у старого
 * клиента. Прокси держит свежий список нод и архивов и сам обходит зеркала;
 * в `from` пишет, какая нода ответила. Один запрос к текущей прокси-ноде: её
 * отказ значит «ролик не найден», остальные ноды не перебираем.
 */
async function fetchVideoInfoViaProxy(host: string, videoId: string): Promise<PeerTubeVideoInfo> {
  const [proxy] = await orderedProxies(servers.servers.production.proxy as ServerEndpoint[])
  if (!proxy) throw new Error('No proxy to ask for the video')
  const link = encodeURIComponent(`peertube://${host}/${videoId}`)
  const response = await fetchWithTimeout(
    `https://${proxy.host}:${proxy.port}/peertube/video?url=${link}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    PEERTUBE_FETCH_TIMEOUT_MS
  )
  if (!response.ok) throw new Error(`Proxy answered ${response.status}`)
  const body = (await response.json()) as { data?: { data?: unknown } } | null
  const info = body?.data?.data
  if (!isVideoInfo(info)) throw new Error('Proxy does not know the video')
  const { from, ...rest } = info
  const servedBy = typeof from === 'string' && HOST_RE.test(from) ? from.toLowerCase() : host
  return { ...rest, servedBy }
}

/** Ищет описание ролика: в архиве выведенной ноды, на ноде из ссылки, через прокси. */
async function resolveVideoInfo(host: string, videoId: string): Promise<PeerTubeVideoInfo> {
  const archive = peertubeArchiveFor(host)
  // Нода выведена из работы — ролик сразу берём из архива, саму ноду пробуем после.
  const hosts = archive ? [archive, host] : [host]
  let failure: PeerTubeFetchError | null = null
  for (const candidate of hosts) {
    try {
      return { ...(await fetchVideoInfoFrom(candidate, videoId)), servedBy: candidate }
    } catch (error) {
      // Интерфейс говорит о ноде из ссылки — её ошибку и отдаём наружу.
      if (candidate === host || !failure) {
        failure =
          error instanceof PeerTubeFetchError
            ? error
            : new PeerTubeFetchError(String(error), 'unknown', error)
      }
    }
  }
  // Нода ответила «такого ролика нет» — он удалён, прокси спрашивать незачем.
  // Иначе нода могла уйти в архив позже нашего списка — спросим прокси.
  if (failure?.code !== 'not-found') {
    try {
      return await fetchVideoInfoViaProxy(host, videoId)
    } catch {
      // Прокси тоже не нашёл — остаётся ошибка ноды из ссылки.
    }
  }
  throw failure ?? new PeerTubeFetchError('peertube fetch failed: unknown error', 'unknown')
}

/**
 * Описание ролика живёт минуту: превью, плеер и субтитры одного ролика
 * получают его одним запросом, а архив и прокси не опрашиваются трижды.
 * Ошибка и ролик в обработке (без HLS и файлов) не запоминаются.
 */
const INFO_TTL_MS = 60_000
const infoCache = new Map<string, { expires: number; promise: Promise<PeerTubeVideoInfo> }>()

/** Забыть запомненные описания (для тестов). */
export function clearPeerTubeInfoCache(): void {
  infoCache.clear()
}

/**
 * Получает информацию о видео через PeerTube API: с ноды из ссылки, для
 * выведенной из работы ноды — сначала из её архива, а если напрямую не вышло,
 * через прокси Bastyon. `servedBy` в ответе — нода, которая его отдала.
 */
export async function getPeerTubeVideoInfo(
  host: string,
  videoId: string
): Promise<PeerTubeVideoInfo> {
  if (!host || !videoId) throw new Error('Host and videoId are required')

  const key = `${host.toLowerCase()}/${videoId}`
  const now = Date.now()
  const cached = infoCache.get(key)
  if (cached && cached.expires > now) return cached.promise
  for (const [k, entry] of infoCache) {
    if (entry.expires <= now) infoCache.delete(k)
  }

  const promise = resolveVideoInfo(host, videoId)
  infoCache.set(key, { expires: now + INFO_TTL_MS, promise })
  const forget = (): void => {
    if (infoCache.get(key)?.promise === promise) infoCache.delete(key)
  }
  promise.then((info) => {
    if (!hasSources(info)) forget()
  }, forget)
  return promise
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
  // Субтитры лежат там же, где ролик: у выведенной ноды — в архиве.
  const servedBy = await getPeerTubeVideoInfo(host, videoId).then(
    (info) => info.servedBy ?? host,
    () => host
  )
  const base = peertubeBase(servedBy)
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
