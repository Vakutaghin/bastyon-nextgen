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
 * ВАЖНО: раньше здесь был неверный контракт (POST на голый `/api/v1/` с JSON `{base64,Action}`
 * без токена) — он давал 404, т.к. такого роута нет. Правильный эндпоинт — `/api/v1/images/upload`
 * с multipart + Bearer.
 *
 * Транспорт — appFetch (через peertubeInstanceFetch): Tor / Tauri plugin-http / dev vite-proxy.
 * imgur-провайдер оставлен заготовкой (нужен подтверждённый прокси-эндпоинт).
 */

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
  host: string
): Promise<{ client_id: string; client_secret: string }> {
  const res = await peertubeInstanceFetch(host, 'api/v1/oauth-clients/local', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`peertube_image_oauth_${res.status}`)
  const j = (await res.json()) as { client_id?: string; client_secret?: string } | null
  if (!j?.client_id || !j?.client_secret) throw new Error('peertube_image_oauth_invalid')
  return { client_id: j.client_id, client_secret: j.client_secret }
}

/** Токен для загрузки картинок: password-грант платформенного аккаунта. */
async function fetchImageUploadToken(host: string): Promise<{ token: string; ttlSeconds: number }> {
  const { client_id, client_secret } = await fetchOauthClient(host)
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
  })
  if (!res.ok) throw new Error(`peertube_image_token_${res.status}`)
  const j = (await res.json()) as { access_token?: string; expires_in?: unknown } | null
  if (!j?.access_token) throw new Error('peertube_image_token_invalid')
  const ttlSeconds = typeof j.expires_in === 'number' ? j.expires_in : DEFAULT_TOKEN_TTL_S
  return { token: j.access_token, ttlSeconds }
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

function postImage(current: UploadSession, blob: Blob): Promise<Response> {
  const form = new FormData()
  form.append('imagefile', blob, 'image')
  return peertubeInstanceFetch(current.host, 'api/v1/images/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${current.token}` },
    body: form,
  })
}

/** Провайдер peertube: хост и токен (из прошлой загрузки или новые) → multipart-загрузка. */
export const peertubeImageProvider: ImageUploadProvider = {
  name: 'peertube',
  async upload(base64: string): Promise<string> {
    const blob = dataUrlToBlob(base64)
    const current = session && session.expiresAt > Date.now() ? session : await openSession()

    let res = await postImage(current, blob)
    if (res.status === 401) {
      // Токен отозван раньше срока: новый — и ещё одна попытка.
      res = await postImage(await openSession(), blob)
    }
    if (!res.ok) throw new Error(`peertube_upload_${res.status}`)

    const data = (await res.json()) as { url?: string } | null
    if (!data?.url) throw new Error('peertube_upload_no_url')
    return withHttpsScheme(data.url)
  },
}

/** Забыть хост и токен (тесты). */
export function resetImageUploadSessionForTests(): void {
  session = null
}

/** Дефолтная цепочка провайдеров. */
export const DEFAULT_IMAGE_PROVIDERS: ImageUploadProvider[] = [peertubeImageProvider]

/**
 * Загружает одно изображение. Если это уже URL (не data:image) — возвращает как есть.
 * Перебирает провайдеров по порядку до первого успеха.
 */
export async function uploadImage(
  base64: string,
  providers: ImageUploadProvider[] = DEFAULT_IMAGE_PROVIDERS
): Promise<string> {
  if (!base64.startsWith('data:image')) return base64

  let lastError: unknown = null
  for (const provider of providers) {
    try {
      return await provider.upload(base64)
    } catch (e) {
      lastError = e
      console.warn(`[image-upload] provider "${provider.name}" failed`, e)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('image_upload_failed')
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
