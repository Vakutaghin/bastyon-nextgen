/**
 * Загрузчик манифестов мини-приложений с диска `https://<scope>/b_manifest.json`.
 *
 * Legacy эквивалент — [index.js:83-125](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L83-L125).
 *
 * Реализация:
 * - in-memory LRU кэш с TTL (по умолчанию 10 минут);
 * - таймаут на fetch через `AbortSignal` (default 10s);
 * - валидация через `parseManifest` (этап 1);
 * - параллельные запросы на один и тот же scope coalesce-ятся в один in-flight Promise.
 */

import { logger } from '@/services/logger'
import { parseManifest, type ParsedManifest } from '../types/manifest'

const log = logger.scope('[mini-apps:manifest]')

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 минут
const DEFAULT_FETCH_TIMEOUT_MS = 10_000
const MAX_CACHE_ENTRIES = 64

interface CacheEntry {
  manifest: ParsedManifest
  fetchedAt: number
}

export interface ManifestLoaderOptions {
  /** TTL кэша в мс. */
  ttlMs?: number
  /** Таймаут fetch'а в мс. */
  timeoutMs?: number
  /** Кастомный fetch (для тестов). */
  fetchImpl?: typeof fetch
}

export class ManifestLoader {
  private cache = new Map<string, CacheEntry>()
  private inflight = new Map<string, Promise<ParsedManifest>>()
  private readonly ttlMs: number
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(opts: ManifestLoaderOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis)
  }

  /**
   * Грузит и парсит манифест по `scope`. Возвращает кэш если он свежий.
   *
   * @param scope — может быть `demo.app.com` или `https://demo.app.com/path` —
   *   в обоих случаях fetch-ит `https://demo.app.com/path/b_manifest.json`.
   * @param force — игнорировать кэш и in-flight, заставить fresh fetch.
   * @throws `ManifestParseError` если манифест невалиден, либо `Error` при сетевой ошибке.
   */
  async load(scope: string, force = false): Promise<ParsedManifest> {
    const url = buildManifestUrl(scope)

    if (!force) {
      const cached = this.cache.get(url)
      if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
        return cached.manifest
      }
      const existing = this.inflight.get(url)
      if (existing) return existing
    }

    const promise = this.fetchAndParse(url).finally(() => {
      this.inflight.delete(url)
    })
    this.inflight.set(url, promise)

    const manifest = await promise
    this.cache.set(url, { manifest, fetchedAt: Date.now() })
    this.enforceCacheLimit()
    return manifest
  }

  /** Принудительно сбрасывает кэш (всё или для одного scope). */
  invalidate(scope?: string): void {
    if (!scope) {
      this.cache.clear()
      return
    }
    this.cache.delete(buildManifestUrl(scope))
  }

  private async fetchAndParse(url: string): Promise<ParsedManifest> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(new Error('manifest_timeout')), this.timeoutMs)
    try {
      const res = await this.fetchImpl(url, {
        signal: ctrl.signal,
        credentials: 'omit',
        redirect: 'follow',
      })
      if (!res.ok) {
        throw new Error(`manifest_http_${res.status}`)
      }
      const text = await res.text()
      const manifest = parseManifest(text)
      log.debug('loaded', url, manifest.id, manifest.versionText)
      return manifest
    } finally {
      clearTimeout(timer)
    }
  }

  /** Простейшая LRU-эвикция: при превышении лимита удаляем самые старые. */
  private enforceCacheLimit(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) return
    const sorted = [...this.cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = sorted.shift()
      if (!oldest) break
      this.cache.delete(oldest[0])
    }
  }
}

/** Строит URL манифеста из scope. */
export function buildManifestUrl(scope: string): string {
  const trimmed = scope
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
  return `https://${trimmed}/b_manifest.json`
}

/** Дефолтный singleton — для production. Тесты используют свой инстанс. */
export const manifestLoader = new ManifestLoader()
