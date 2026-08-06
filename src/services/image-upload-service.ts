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
 * ВАЖНО: раньше здесь был неверный контракт (POST на голый `/api/v1/` с JSON `{base64,Action}`
 * без токена) — он давал 404, т.к. такого роута нет. Правильный эндпоинт — `/api/v1/images/upload`
 * с multipart + Bearer.
 *
 * Транспорт — appFetch (через peertubeInstanceFetch): Tor / Tauri plugin-http / dev vite-proxy.
 * imgur-провайдер оставлен заготовкой (нужен подтверждённый прокси-эндпоинт).
 */

import { resolvePeertubeHost } from '@/services/peertube/peertube-host'
import { peertubeInstanceFetch, serializeForm } from '@/services/peertube/peertube-instance'

/** Провайдер загрузки: принимает data-URL, возвращает публичный URL. */
export interface ImageUploadProvider {
  name: string
  upload: (base64: string) => Promise<string>
}

/** Платформенный аккаунт анонимной загрузки картинок (js/app.js:235 peertubeCreds). */
const IMAGE_UPLOAD_CREDS = { username: 'test_bastyon', password: 'test_bastyon' }

/** Достраивает протокол, если узел вернул URL без схемы. */
export function normalizeImageUrl(url: string): string {
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
async function fetchOauthClient(host: string): Promise<{ client_id: string; client_secret: string }> {
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
async function fetchImageUploadToken(host: string): Promise<string> {
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
  const j = (await res.json()) as { access_token?: string } | null
  if (!j?.access_token) throw new Error('peertube_image_token_invalid')
  return j.access_token
}

/** Провайдер peertube: резолв узла → токен → multipart-загрузка. */
export const peertubeImageProvider: ImageUploadProvider = {
  name: 'peertube',
  async upload(base64: string): Promise<string> {
    const host = await resolvePeertubeHost('upload')
    const token = await fetchImageUploadToken(host)

    const form = new FormData()
    form.append('imagefile', dataUrlToBlob(base64), 'image')

    const res = await peertubeInstanceFetch(host, 'api/v1/images/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) throw new Error(`peertube_upload_${res.status}`)

    const data = (await res.json()) as { url?: string } | null
    if (!data?.url) throw new Error('peertube_upload_no_url')
    return normalizeImageUrl(data.url)
  },
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
