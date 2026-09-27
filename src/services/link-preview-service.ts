/**
 * Превью обычной веб-ссылки — заголовок, описание, картинка — от ноды:
 * HTTP-метод прокси `urlPreview` (pocketnet.gui proxy16/proxy.js). Страницу
 * скачивает нода, поэтому сайт из ссылки не видит IP читателя; картинку
 * превью карточка грузит через TorImage, как любую стороннюю.
 *
 * Результат (и отсутствие превью) кэшируется: одна ссылка — один запрос на
 * всё приложение, сколько бы постов с ней ни было в ленте.
 */

import { fetchHttp } from '@/helpers/api/request'

export interface LinkPreview {
  /** Ссылка, для которой получено превью. */
  url: string
  title?: string
  description?: string
  siteName?: string
  /** Абсолютный http(s)-адрес картинки. */
  image?: string
}

const CACHE_LIMIT = 300
const DESCRIPTION_MAX = 220
/** Страницу нода качает сама, долгие сайты не должны держать карточку. */
const REQUEST_TIMEOUT_MS = 15_000

const cache = new Map<string, LinkPreview | null>()
const inflight = new Map<string, Promise<LinkPreview | null>>()

/** HTML-сущности из OG-тегов (`&quot;`, `&amp;`) → символы; разметка отбрасывается. */
function decodeEntities(text: string): string {
  if (!text.includes('&') && !text.includes('<')) return text
  if (typeof DOMParser === 'undefined') return text
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return doc.body.textContent ?? text
}

function cleanText(value: unknown, max?: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return max && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

function cleanImage(value: unknown, pageUrl: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(decodeEntities(value.trim()), pageUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/**
 * Заглушки защиты от ботов (Cloudflare и т. п.): нода получила их вместо
 * страницы, и карточка «Just a moment...» только сбивала бы с толку.
 */
const BOT_WALL_TITLE_RE = /^(just a moment|attention required|access denied|checking your browser)/i

/** Ответ ноды (`{ og }`) → превью; без заголовка, описания и картинки — null. */
export function normalizeLinkPreview(url: string, response: unknown): LinkPreview | null {
  const og =
    response && typeof response === 'object' ? (response as { og?: unknown }).og : undefined
  if (!og || typeof og !== 'object') return null
  const tags = og as Record<string, unknown>
  const preview: LinkPreview = {
    url,
    title: cleanText(tags.title),
    description: cleanText(tags.description, DESCRIPTION_MAX),
    siteName: cleanText(tags.site_name),
    image: cleanImage(tags.image, url),
  }
  if (preview.title && BOT_WALL_TITLE_RE.test(preview.title) && !preview.image) return null
  return preview.title || preview.description || preview.image ? preview : null
}

function remember(url: string, preview: LinkPreview | null): void {
  cache.delete(url)
  cache.set(url, preview)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/** Превью из кэша: undefined — ещё не запрашивали, null — превью нет. */
export function cachedLinkPreview(url: string): LinkPreview | null | undefined {
  return cache.get(url)
}

export interface LinkPreviewDeps {
  fetchHttp: typeof fetchHttp
}

/**
 * Превью ссылки через ноду; null — превью нет (карточки просто не будет).
 * Ответ ноды кэшируется, сбой сети — нет: при следующем показе спросим снова.
 */
export async function fetchLinkPreview(
  url: string,
  deps: LinkPreviewDeps = { fetchHttp }
): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url) ?? null
  const pending = inflight.get(url)
  if (pending) return pending

  const request = deps
    .fetchHttp({
      path: 'urlPreview',
      data: { url },
      options: { auth: false, timeout: REQUEST_TIMEOUT_MS },
    })
    .then((response) => {
      const preview = normalizeLinkPreview(url, response)
      remember(url, preview)
      return preview
    })
    .catch(() => null)
    .finally(() => inflight.delete(url))

  inflight.set(url, request)
  return request
}

/** Только для тестов. */
export function clearLinkPreviewCache(): void {
  cache.clear()
  inflight.clear()
}
