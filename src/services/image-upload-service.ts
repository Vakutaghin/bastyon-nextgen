/**
 * Загрузка изображений поста на PeerTube-инстанс.
 *
 * Реальный контракт (порт из pocketnet.gui/js/functions.js:7247-7330 + js/image-uploader.js):
 *   1) резолв узла:  proxy `peertube/best` { type: 'upload' } → host
 *   2) токен:        oauth-clients/local → POST users/token (grant_type=password,
 *                    креды платформенного аккаунта `test_bastyon`) → access_token
 *   3) загрузка:     POST {host}/api/v1/images/upload — multipart FormData `imagefile`=Blob,
 *                    Authorization: Bearer → { url }
 *
 * Общий аккаунт есть не на каждом инстансе загрузки. 29.09.2026 нода в двух
 * случаях из трёх выбирала peertube1000, где `test_bastyon` отвечает
 * `invalid_grant` (400), и пост с картинкой не публиковался
 * («peertube_image_token_400»). Поэтому хост, отказавший в токене,
 * пропускается и пробуются остальные хосты загрузки (`peertube/roys`), а
 * сработавший запоминается вместе с токеном, пока тот жив (инстанс даёт
 * сутки): следующим картинкам не нужны ни выбор хоста, ни новый токен.
 * Старый клиент тоже выбирает хост картинок один раз за сессию.
 *
 * Если PeerTube картинку не принял (ни один хост не выдал токен, загрузка
 * упала или зависла), она уходит на сервер картинок Bastyon
 * `pocketnet.app:8092` — туда же грузит старый клиент. Сервер бывает
 * недоступен, поэтому он запасной. Каждый запрос ограничен по времени:
 * зависший сервер не должен держать публикацию.
 *
 * ВАЖНО: раньше здесь был неверный контракт (POST на голый `/api/v1/` с JSON `{base64,Action}`
 * без токена) — он давал 404, т.к. такого роута нет. Правильный эндпоинт — `/api/v1/images/upload`
 * с multipart + Bearer.
 *
 * Транспорт — appFetch (через peertubeInstanceFetch): Tor / Tauri plugin-http / dev vite-proxy.
 * imgur-провайдер оставлен заготовкой (нужен подтверждённый прокси-эндпоинт).
 */

import { appFetch } from '@/helpers/api/request'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { resolvePeertubeHost, resolvePeertubeHosts } from '@/services/peertube/peertube-host'
import { peertubeInstanceFetch, serializeForm } from '@/services/peertube/peertube-instance'

/** Провайдер загрузки: принимает data-URL, возвращает публичный URL. */
export interface ImageUploadProvider {
  name: string
  upload: (base64: string) => Promise<string>
}

/** Платформенный аккаунт анонимной загрузки картинок (js/app.js:235 peertubeCreds). */
const IMAGE_UPLOAD_CREDS = { username: 'test_bastyon', password: 'test_bastyon' }

/** Срок токена, если инстанс его не назвал. */
const DEFAULT_TOKEN_TTL_S = 600
/** Токен, который вот-вот истечёт, не берём: он может кончиться посреди загрузки. */
const TOKEN_MARGIN_MS = 60_000
/** Токен выдаётся за доли секунды; дольше — хост завис, берём следующий. */
export const TOKEN_TIMEOUT_MS = 20_000
/** Картинка до 1920×1080 грузится за секунды и по медленной сети. */
export const UPLOAD_TIMEOUT_MS = 60_000

/** Сервер картинок Bastyon: запасной путь, как у старого клиента (js/functions.js). */
const UP1_URL = 'https://pocketnet.app:8092/up'
/** Публичный ключ из исходников старого клиента: без него сервер отвечает «API key doesn't match». */
const UP1_API_KEY = 'c61540b5ceecd05092799f936e277552'
export const UP1_TIMEOUT_MS = 30_000

/**
 * Запрос с ограничением по времени на всё сразу — ответ и его тело. По
 * истечении запрос отменяется и бросается ошибка с кодом `code`.
 */
async function withTimeout<T>(
  ms: number,
  code: string,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } catch (e) {
    if (controller.signal.aborted) throw new Error(code, { cause: e })
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Достраивает протокол, если узел вернул URL без схемы. */
export function withHttpsScheme(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

/** data:image/...;base64,XXXX → Blob (без промежуточного fetch — работает и в Tauri plugin-http). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** oauth-clients/local → { client_id, client_secret } (нужны для password-гранта). */
async function fetchOauthClient(
  host: string,
  signal: AbortSignal
): Promise<{ client_id: string; client_secret: string }> {
  const res = await peertubeInstanceFetch(host, 'api/v1/oauth-clients/local', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`peertube_image_oauth_${res.status}`)
  const j = (await res.json()) as { client_id?: string; client_secret?: string } | null
  if (!j?.client_id || !j?.client_secret) throw new Error('peertube_image_oauth_invalid')
  return { client_id: j.client_id, client_secret: j.client_secret }
}

/** Токен для загрузки картинок: password-грант платформенного аккаунта. */
function fetchImageUploadToken(host: string): Promise<{ token: string; ttlSeconds: number }> {
  return withTimeout(TOKEN_TIMEOUT_MS, 'peertube_image_token_timeout', async (signal) => {
    const { client_id, client_secret } = await fetchOauthClient(host, signal)
    const res = await peertubeInstanceFetch(host, 'api/v1/users/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: serializeForm({
        client_id,
        client_secret,
        grant_type: 'password',
        response_type: 'code',
        ...IMAGE_UPLOAD_CREDS,
      }),
      signal,
    })
    if (!res.ok) throw new Error(`peertube_image_token_${res.status}`)
    const j = (await res.json()) as { access_token?: string; expires_in?: unknown } | null
    if (!j?.access_token) throw new Error('peertube_image_token_invalid')
    const ttlSeconds = typeof j.expires_in === 'number' ? j.expires_in : DEFAULT_TOKEN_TTL_S
    return { token: j.access_token, ttlSeconds }
  })
}

/** Хост, принявший общий аккаунт, и его токен. */
interface UploadSession {
  host: string
  token: string
  expiresAt: number
}

let session: UploadSession | null = null

/** Хосты загрузки по порядку: сработавший раньше, выбранный нодой, остальные рои. */
async function candidateHosts(preferred: string | undefined): Promise<string[]> {
  const hosts: string[] = []
  const add = (host: string | null | undefined): void => {
    const h = host?.trim()
    if (h && !hosts.includes(h)) hosts.push(h)
  }
  add(preferred)
  const [best, roys] = await Promise.allSettled([
    resolvePeertubeHost('upload'),
    resolvePeertubeHosts('upload'),
  ])
  if (best.status === 'fulfilled') add(best.value)
  else console.warn('[image-upload] peertube/best failed', best.reason)
  if (roys.status === 'fulfilled') roys.value.forEach(add)
  else console.warn('[image-upload] peertube/roys failed', roys.reason)
  if (!hosts.length) throw new Error('peertube_no_host')
  return hosts
}

/** Первый хост, выдавший токен общего аккаунта. Отказавшие пропускаются. */
async function openSession(): Promise<UploadSession> {
  const preferred = session?.host
  session = null
  let lastError: unknown = null
  for (const host of await candidateHosts(preferred)) {
    try {
      const { token, ttlSeconds } = await fetchImageUploadToken(host)
      session = { host, token, expiresAt: Date.now() + ttlSeconds * 1000 - TOKEN_MARGIN_MS }
      return session
    } catch (e) {
      lastError = e
      console.warn(`[image-upload] ${host} refused the upload account`, e)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('peertube_image_token_failed')
}

/** Загрузка на хост сессии: статус ответа и, если картинку приняли, её адрес. */
function postImage(current: UploadSession, blob: Blob): Promise<{ status: number; url?: string }> {
  return withTimeout(UPLOAD_TIMEOUT_MS, 'peertube_upload_timeout', async (signal) => {
    const form = new FormData()
    form.append('imagefile', blob, 'image')
    const res = await peertubeInstanceFetch(current.host, 'api/v1/images/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${current.token}` },
      body: form,
      signal,
    })
    if (!res.ok) return { status: res.status }
    const data = (await res.json()) as { url?: string } | null
    return { status: res.status, url: data?.url }
  })
}

/** Провайдер peertube: хост и токен (из прошлой загрузки или новые) → multipart-загрузка. */
export const peertubeImageProvider: ImageUploadProvider = {
  name: 'peertube',
  async upload(base64: string): Promise<string> {
    const blob = dataUrlToBlob(base64)
    const current = session && session.expiresAt > Date.now() ? session : await openSession()

    let posted = await postImage(current, blob)
    if (posted.status === 401) {
      // Токен отозван раньше срока: новый — и ещё одна попытка.
      posted = await postImage(await openSession(), blob)
    }
    if (posted.status < 200 || posted.status >= 300) {
      throw new Error(`peertube_upload_${posted.status}`)
    }
    if (!posted.url) throw new Error('peertube_upload_no_url')
    return withHttpsScheme(posted.url)
  },
}

/**
 * Провайдер up1 — сервер картинок Bastyon. Принимает base64 без префикса
 * `data:` формой и отвечает идентификатором файла.
 */
export const up1ImageProvider: ImageUploadProvider = {
  name: 'up1',
  async upload(base64: string): Promise<string> {
    const comma = base64.indexOf(',')
    const file = comma >= 0 ? base64.slice(comma + 1) : base64
    const data = await withTimeout(UP1_TIMEOUT_MS, 'up1_timeout', async (signal) => {
      const res = await appFetch(UP1_URL, {
        method: 'POST',
        // Простой запрос без preflight: CORS сервер отдаёт только на сам POST.
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: serializeForm({ file, api_key: UP1_API_KEY }),
        signal,
      })
      if (!res.ok) throw new Error(`up1_upload_${res.status}`)
      return (await res.json()) as { data?: { ident?: unknown } } | null
    })
    const ident = data?.data?.ident
    if (typeof ident !== 'string' || !ident) throw new Error('up1_upload_no_ident')
    return resolveImageUrl(ident) ?? ident
  },
}

/** Забыть хост и токен (тесты). */
export function resetImageUploadSessionForTests(): void {
  session = null
}

/** Дефолтная цепочка провайдеров: PeerTube, а если не вышло — сервер картинок Bastyon. */
export const DEFAULT_IMAGE_PROVIDERS: ImageUploadProvider[] = [
  peertubeImageProvider,
  up1ImageProvider,
]

/** Картинку не принял ни один провайдер; в `message` — причина от каждого. */
export class ImageUploadError extends Error {
  constructor(readonly reasons: string[]) {
    super(reasons.join('; ') || 'image_upload_failed')
    this.name = 'ImageUploadError'
  }
}

/**
 * Загружает одно изображение. Если это уже URL (не data:image) — возвращает как есть.
 * Перебирает провайдеров по порядку до первого успеха; если не принял ни один —
 * `ImageUploadError` с причинами от каждого.
 */
export async function uploadImage(
  base64: string,
  providers: ImageUploadProvider[] = DEFAULT_IMAGE_PROVIDERS
): Promise<string> {
  if (!base64.startsWith('data:image')) return base64

  const reasons: string[] = []
  for (const provider of providers) {
    try {
      return await provider.upload(base64)
    } catch (e) {
      reasons.push(`${provider.name}: ${e instanceof Error ? e.message : String(e)}`)
      console.warn(`[image-upload] provider "${provider.name}" failed`, e)
    }
  }

  throw new ImageUploadError(reasons)
}

/** Загружает массив изображений последовательно, сохраняя порядок. */
export async function uploadImages(
  images: string[],
  providers: ImageUploadProvider[] = DEFAULT_IMAGE_PROVIDERS
): Promise<string[]> {
  const result: string[] = []
  for (const image of images) {
    result.push(await uploadImage(image, providers))
  }
  return result
}
