import { ref, watch, type Ref } from 'vue'

import { matrixService } from '../../services/matrix-service'

/**
 * Нормализованный preview-объект для UI. null = превью отсутствует/невозможно получить.
 */
export interface LinkPreviewData {
  url: string
  title?: string
  description?: string
  siteName?: string
  imageUrl?: string
}

const LRU_LIMIT = 200
const DESCRIPTION_MAX_LEN = 200

/** Модуль-локальный LRU-кэш по URL → результат (или null если не нашли). */
const cache = new Map<string, LinkPreviewData | null>()

/** In-flight запросы: один URL → один сетевой запрос на всё приложение, даже из нескольких сообщений. */
const inflight = new Map<string, Promise<LinkPreviewData | null>>()

const trimDescription = (s?: string): string | undefined => {
  if (!s) return undefined
  const cleaned = s.replace(/\s+/g, ' ').trim()
  if (!cleaned) return undefined
  if (cleaned.length <= DESCRIPTION_MAX_LEN) return cleaned
  return cleaned.slice(0, DESCRIPTION_MAX_LEN).trimEnd() + '…'
}

/** mxc:// → http(s) для og:image. */
const resolveImage = (mxc?: string): string | undefined => {
  if (!mxc) return undefined
  if (mxc.startsWith('http://') || mxc.startsWith('https://')) return mxc
  if (mxc.startsWith('mxc://')) {
    const http = matrixService.mxcToHttp(mxc)
    return http || undefined
  }
  return undefined
}

const lruTouch = (url: string) => {
  // Map сохраняет порядок вставки; чтобы «обновить» recency — пере-выставим.
  if (cache.has(url)) {
    const v = cache.get(url)!
    cache.delete(url)
    cache.set(url, v)
  }
}

const lruSet = (url: string, value: LinkPreviewData | null) => {
  if (cache.has(url)) cache.delete(url)
  cache.set(url, value)
  while (cache.size > LRU_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

const fetchPreview = async (url: string): Promise<LinkPreviewData | null> => {
  if (cache.has(url)) {
    lruTouch(url)
    return cache.get(url) ?? null
  }
  const existing = inflight.get(url)
  if (existing) return existing

  const promise = (async () => {
    try {
      const client = matrixService.getClient()
      if (!client || typeof client.getUrlPreview !== 'function') {
        lruSet(url, null)
        return null
      }
      const ts = Date.now()
      const raw = await client.getUrlPreview(url, ts)
      if (!raw || typeof raw !== 'object') {
        lruSet(url, null)
        return null
      }
      const og = raw as Record<string, string | number | undefined>
      const title = typeof og['og:title'] === 'string' ? (og['og:title'] as string) : undefined
      const description = trimDescription(
        typeof og['og:description'] === 'string' ? (og['og:description'] as string) : undefined
      )
      const siteName =
        typeof og['og:site_name'] === 'string' ? (og['og:site_name'] as string) : undefined
      const imageUrl = resolveImage(
        typeof og['og:image'] === 'string' ? (og['og:image'] as string) : undefined
      )
      if (!title && !description && !imageUrl) {
        lruSet(url, null)
        return null
      }
      const data: LinkPreviewData = { url, title, description, siteName, imageUrl }
      lruSet(url, data)
      return data
    } catch (_e) {
      lruSet(url, null)
      return null
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, promise)
  return promise
}

/**
 * Реактивно тянет OG-превью по url. Кэширует результат в module-scope LRU.
 * Возвращает `{ preview, isLoading }` — компонент рендерит только если `preview.value` != null.
 */
export const useLinkPreview = (urlRef: Ref<string | null | undefined>) => {
  const preview = ref<LinkPreviewData | null>(null)
  const isLoading = ref(false)

  watch(
    urlRef,
    async (url) => {
      preview.value = null
      if (!url) return
      // Быстрый путь — из кэша синхронно
      if (cache.has(url)) {
        lruTouch(url)
        preview.value = cache.get(url) ?? null
        return
      }
      isLoading.value = true
      try {
        preview.value = await fetchPreview(url)
      } finally {
        isLoading.value = false
      }
    },
    { immediate: true }
  )

  return { preview, isLoading }
}

/** Доступ к internals — нужен только для тестов и DevTools. */
export const __linkPreviewInternals = { cache, inflight, fetchPreview, lruSet }
