// Таблица городов: формат из scripts/update-geo-cities.mjs, поиск по IPv4,
// скачивание один раз (основной адрес или зеркало) и хранение на устройстве.

import 'fake-indexeddb/auto'
import { gzipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/helpers/api/fetch-strategies', () => ({ appFetch: h.fetch }))

import { GEO_TABLE_URLS, loadGeoTable, parseGeoTable, resetGeoTableForTests } from './ip-geo'

/** Таблица в формате скрипта: места [широта, долгота], диапазоны [блок /24, номер места + 1]. */
function table(places: Array<[number, number]>, ranges: Array<[number, number]>): Uint8Array {
  const bytes: number[] = []
  const u32 = (v: number) => bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, v >>> 24)
  const i16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff)
  const varint = (v: number) => {
    for (;;) {
      const b = v % 128
      v = Math.floor(v / 128)
      if (!v) return bytes.push(b)
      bytes.push(b | 0x80)
    }
  }
  bytes.push(...'IPGC'.split('').map((c) => c.charCodeAt(0)), 1)
  u32(20261001)
  u32(places.length)
  for (const [lat, lon] of places) {
    i16(Math.round(lat * 100))
    i16(Math.round(lon * 100))
  }
  u32(ranges.length)
  let last = 0
  for (const [block, place] of ranges) {
    varint(block - last)
    last = block
    varint(place)
  }
  return Uint8Array.from(bytes)
}

const block = (ip: string) => ip.split('.').reduce((a, b) => a * 256 + Number(b), 0) / 256

/** 5.9.0.0/16 — Фалькенштейн, 95.31.0.0/16 — Москва, остальное неизвестно. */
const SAMPLE = table(
  [
    [50.48, 12.37],
    [55.75, 37.62],
  ],
  [
    [0, 0],
    [block('5.9.0.0'), 1],
    [block('5.10.0.0'), 0],
    [block('95.31.0.0'), 2],
    [block('95.32.0.0'), 0],
  ]
)

function response(bytes: Uint8Array, status = 200): Response {
  return new Response(bytes as Uint8Array<ArrayBuffer>, { status })
}

async function clearCache(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('BastyonGeo')
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}

describe('parseGeoTable', () => {
  it('город по IPv4; IPv6, частные и чужой формат — нет', () => {
    const geo = parseGeoTable(SAMPLE)
    expect(geo.date).toBe('2026-10-01')
    expect(geo.lookup('5.9.10.10')).toEqual([50.48, 12.37])
    expect(geo.lookup('95.31.45.162')).toEqual([55.75, 37.62])
    expect(geo.lookup('8.8.8.8')).toBeNull()
    expect(geo.lookup('2a01:4f8::1')).toBeNull()
    expect(() => parseGeoTable(Uint8Array.from([1, 2, 3, 4, 5]))).toThrow('bad table')
  })
})

describe('loadGeoTable', () => {
  beforeEach(async () => {
    resetGeoTableForTests()
    h.fetch.mockReset()
    await clearCache()
  })

  it('качает один раз: дальше — с устройства, без сети', async () => {
    h.fetch.mockResolvedValue(response(gzipSync(SAMPLE)))
    const first = await loadGeoTable()
    expect(first.lookup('5.9.10.10')).toEqual([50.48, 12.37])
    expect(h.fetch).toHaveBeenCalledTimes(1)
    expect(h.fetch.mock.calls[0]![0]).toBe(GEO_TABLE_URLS[0])

    resetGeoTableForTests()
    const again = await loadGeoTable()
    expect(again.lookup('95.31.45.162')).toEqual([55.75, 37.62])
    expect(h.fetch).toHaveBeenCalledTimes(1)
  })

  it('основной адрес не ответил — зеркало', async () => {
    h.fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response(gzipSync(SAMPLE)))
    const geo = await loadGeoTable()
    expect(geo.lookup('5.9.10.10')).not.toBeNull()
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(GEO_TABLE_URLS)
  })

  it('старая таблица сгодится, если свежую не скачать; без неё — ошибка', async () => {
    h.fetch
      .mockResolvedValueOnce(response(new Uint8Array(), 404))
      .mockResolvedValueOnce(response(new Uint8Array(), 404))
    await expect(loadGeoTable()).rejects.toThrow('HTTP 404')

    h.fetch.mockResolvedValue(response(gzipSync(SAMPLE)))
    const saved = Date.UTC(2026, 0, 1)
    await loadGeoTable(saved)
    resetGeoTableForTests()
    h.fetch.mockReset().mockRejectedValue(new TypeError('Failed to fetch'))
    const stale = await loadGeoTable(saved + 365 * 24 * 3600 * 1000)
    expect(stale.lookup('5.9.10.10')).toEqual([50.48, 12.37])
    expect(h.fetch).toHaveBeenCalled()
  })
})
