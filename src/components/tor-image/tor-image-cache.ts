// Кэш картинок, загруженных через Tor: URL → blob-URL. Модульный, чтобы
// повторный монт карточки в ленте не тянул картинку заново и чтобы галерея
// могла открыть уже загруженное. LRU с отзывом object-URL при вытеснении.

import { appFetch } from '@/helpers/api/fetch-strategies'

const MAX_ENTRIES = 100

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

export function getTorImageUrl(src: string): string | undefined {
  const hit = cache.get(src)
  if (hit) {
    // Map хранит порядок вставки — переставляем в хвост как «свежее».
    cache.delete(src)
    cache.set(src, hit)
  }
  return hit
}

function remember(src: string, blobUrl: string): void {
  cache.set(src, blobUrl)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    const url = cache.get(oldest)
    cache.delete(oldest)
    if (url) URL.revokeObjectURL(url)
  }
}

/** Грузит картинку через `appFetch` (под Tor — torFetch) и отдаёт blob-URL. */
export function loadTorImage(src: string): Promise<string> {
  const cached = getTorImageUrl(src)
  if (cached) return Promise.resolve(cached)
  const existing = inflight.get(src)
  if (existing) return existing

  const p = (async () => {
    const res = await appFetch(src, { credentials: 'omit' })
    if (!res.ok) throw new Error(`http ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    remember(src, url)
    return url
  })().finally(() => inflight.delete(src))
  inflight.set(src, p)
  return p
}

/** Для тестов. */
export function resetTorImageCache(): void {
  for (const url of cache.values()) URL.revokeObjectURL(url)
  cache.clear()
  inflight.clear()
}
