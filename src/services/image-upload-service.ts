/**
 * Загрузка изображений поста.
 *
 * Стратегия (решение по [[principle_decentralization]]): peertube-first.
 * Портировано из pocketnet.gui/js/image-uploader.js:
 *   - резолв сервера: proxy `peertube/best` { type: 'upload' } → { host }
 *   - загрузка:       POST { base64, Action: 'upload' } на {host}/api/v1/ → { url }
 *
 * Архитектура — цепочка провайдеров: uploadImage перебирает их по порядку, отдавая
 * первый успех. imgur-провайдер оставлен заготовкой (нужен подтверждённый прокси-эндпоинт),
 * поэтому в DEFAULT_IMAGE_PROVIDERS пока только peertube.
 *
 * ВНИМАНИЕ: реальная загрузка на живой узел НЕ прогонялась (нет залогиненного аккаунта в тестах).
 * Контракт выверен по legacy; сетевые детали (CORS/подпись) могут потребовать правки.
 */

import { appFetch, fetchHttp } from '@/helpers/api/request'

/** Провайдер загрузки: принимает data-URL, возвращает публичный URL. */
export interface ImageUploadProvider {
  name: string
  upload: (base64: string) => Promise<string>
}

/** В dev-браузере ходим через vite-прокси `/api/peertube/...`, чтобы обойти CORS (как в peertube-api.ts). */
const isDevBrowser = (): boolean =>
  typeof import.meta !== 'undefined' &&
  import.meta.env?.DEV === true &&
  typeof window !== 'undefined'

/** Достраивает протокол, если узел вернул URL без схемы. */
export function normalizeImageUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

/** Резолвит лучший upload-узел через прокси (peertube/best). */
async function resolveUploadHost(): Promise<string> {
  const res = (await fetchHttp({ path: 'peertube/best', data: { type: 'upload' } })) as
    | { host?: string }
    | string
    | null

  const host = typeof res === 'string' ? res : res?.host
  if (!host) throw new Error('peertube_no_host')
  return host
}

/** Провайдер peertube: резолв узла + POST base64. */
export const peertubeImageProvider: ImageUploadProvider = {
  name: 'peertube',
  async upload(base64: string): Promise<string> {
    const host = await resolveUploadHost()
    const url = isDevBrowser() ? `/api/peertube/${host}/api/v1/` : `https://${host}/api/v1/`

    const response = await appFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify({ base64, Action: 'upload' }),
    })

    if (!response.ok) throw new Error(`peertube_upload_${response.status}`)

    const data = (await response.json()) as { url?: string } | null
    const out = data?.url
    if (!out) throw new Error('peertube_upload_no_url')
    return normalizeImageUrl(out)
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
