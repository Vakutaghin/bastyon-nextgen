/**
 * Где нода на карте — город по её IPv4, с точностью около 10 км: таблица DB-IP
 * (scripts/update-geo-cities.mjs). Она весит ~4 МБ и в установщик не входит:
 * приложение скачивает её целиком, когда открывают раскладку «Карта», и
 * хранит у себя. Адреса нод никуда не уходят — ищем у себя, как и страну;
 * под Tor таблица идёт через Tor. Без таблицы нода стоит в своей стране.
 */

import { gunzipSync } from 'fflate'
import { appFetch } from '@/helpers/api/fetch-strategies'
import { ipv4ToNumber } from './ip-country'

/** Широта и долгота, градусы. */
export type LatLon = readonly [lat: number, lon: number]

export interface GeoTable {
  /** На какой день данные DB-IP, `ГГГГ-ММ-ДД`. */
  date: string
  /** Место по IPv4; null — неизвестно или IPv6. */
  lookup(ip: string): LatLon | null
}

const MAGIC = 'IPGC'
const FORMAT = 1

/** Откуда качать: файл лежит в репозитории приложения; второй адрес — зеркало. */
export const GEO_TABLE_URLS = [
  'https://raw.githubusercontent.com/Vakutaghin/bastyon-nextgen/main/geo-data/ipv4-city.bin.gz',
  'https://cdn.jsdelivr.net/gh/Vakutaghin/bastyon-nextgen@main/geo-data/ipv4-city.bin.gz',
]

/** Сколько хранить скачанную таблицу, прежде чем попробовать свежую. */
const FRESH_MS = 60 * 24 * 3600 * 1000
const DOWNLOAD_TIMEOUT_MS = 120_000

/** Разбор формата из scripts/update-geo-cities.mjs (уже без gzip). */
export function parseGeoTable(bytes: Uint8Array): GeoTable {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC || bytes[4] !== FORMAT) {
    throw new Error('ip-geo: bad table')
  }
  const rawDate = String(view.getUint32(5, true))
  const placeCount = view.getUint32(9, true)
  let at = 13
  const places = new Int16Array(placeCount * 2)
  for (let i = 0; i < places.length; i++, at += 2) places[i] = view.getInt16(at, true)
  const count = view.getUint32(at, true)
  at += 4

  const varint = (): number => {
    let value = 0
    let mul = 1
    for (;;) {
      const b = bytes[at++]!
      value += (b & 0x7f) * mul
      if (b < 0x80) return value
      mul *= 128
    }
  }
  const starts = new Uint32Array(count)
  const placeOf = new Uint32Array(count)
  let last = 0
  for (let i = 0; i < count; i++) {
    last += varint()
    starts[i] = last
    placeOf[i] = varint()
  }
  if (at > bytes.length) throw new Error('ip-geo: truncated table')

  return {
    date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
    lookup(ip) {
      const n = ipv4ToNumber(ip)
      if (n === null || !count) return null
      const block = Math.floor(n / 256)
      let lo = 0
      let hi = count - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (starts[mid]! <= block) lo = mid
        else hi = mid - 1
      }
      const place = starts[lo]! <= block ? placeOf[lo]! : 0
      if (!place) return null
      return [places[(place - 1) * 2]! / 100, places[(place - 1) * 2 + 1]! / 100]
    },
  }
}

// --- Хранение на устройстве: отдельная база, чтобы не трогать схему приложения.

const CACHE_DB = 'BastyonGeo'
const STORE = 'files'
const KEY = 'ipv4-city'

interface CachedFile {
  gz: Uint8Array
  savedAt: number
}

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readCached(): Promise<CachedFile | null> {
  try {
    const idb = await openCache()
    try {
      return await new Promise<CachedFile | null>((resolve, reject) => {
        const req = idb.transaction(STORE).objectStore(STORE).get(KEY)
        req.onsuccess = () => resolve((req.result as CachedFile | undefined) ?? null)
        req.onerror = () => reject(req.error)
      })
    } finally {
      idb.close()
    }
  } catch {
    return null
  }
}

async function writeCached(file: CachedFile): Promise<void> {
  try {
    const idb = await openCache()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(file, KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      idb.close()
    }
  } catch {
    // нет места или база недоступна — таблица проживёт до перезапуска
  }
}

async function download(): Promise<Uint8Array> {
  let lastError: unknown = null
  for (const url of GEO_TABLE_URLS) {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), DOWNLOAD_TIMEOUT_MS)
    try {
      const res = await appFetch(url, { signal: abort.signal })
      if (!res.ok) throw new Error(`ip-geo: HTTP ${res.status}`)
      return new Uint8Array(await res.arrayBuffer())
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new Error('ip-geo: no source')
}

let loading: Promise<GeoTable> | null = null

/** Таблица с устройства или из сети; старая сгодится, если свежую не скачать. */
export function loadGeoTable(now = Date.now()): Promise<GeoTable> {
  loading ??= (async () => {
    const cached = await readCached()
    if (cached && now - cached.savedAt < FRESH_MS) {
      try {
        return parseGeoTable(gunzipSync(cached.gz))
      } catch {
        // испорчена — качаем заново
      }
    }
    try {
      const gz = await download()
      const table = parseGeoTable(gunzipSync(gz))
      await writeCached({ gz, savedAt: now })
      return table
    } catch (error) {
      if (cached) return parseGeoTable(gunzipSync(cached.gz))
      throw error
    }
  })().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/** Сброс для тестов. */
export function resetGeoTableForTests(): void {
  loading = null
}
