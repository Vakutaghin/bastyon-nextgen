/**
 * Страна ноды по её IPv4 — по встроенной таблице (scripts/update-geo-data.mjs):
 * кому региональный регистратор выдал блок адресов. Таблица лежит в самом
 * приложении, поэтому адреса нод никуда не уходят и всё работает под Tor.
 * Грузится только с вкладкой «Сеть». IPv6 таблица не знает — страна неизвестна.
 */

import tableUrl from './data/ipv4-country.bin?url'

export interface CountryTable {
  /** На какой день данные регистраторов, `ГГГГ-ММ-ДД`. */
  date: string
  /** ISO-код страны или null: адрес не выдан, частный или IPv6. */
  lookup(ip: string): string | null
}

const MAGIC = 'IPCC'

export function ipv4ToNumber(ip: string): number | null {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((p) => p > 255)) return null
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!
}

/** Разбор формата из scripts/update-geo-data.mjs. */
export function parseCountryTable(buffer: ArrayBuffer): CountryTable {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) {
    throw new Error('ip-country: bad table')
  }
  const rawDate = String(view.getUint32(4, true))
  const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
  const codeCount = view.getUint16(8, true)
  let at = 10
  const codes: string[] = []
  for (let i = 0; i < codeCount; i++, at += 2) {
    codes.push(String.fromCharCode(bytes[at]!, bytes[at + 1]!))
  }
  const count = view.getUint32(at, true)
  at += 4
  const starts = new Uint32Array(count)
  const codeOf = new Uint8Array(count)
  let last = 0
  for (let i = 0; i < count; i++) {
    let delta = 0
    let mul = 1
    for (;;) {
      const b = bytes[at++]!
      delta += (b & 0x7f) * mul
      if (b < 0x80) break
      mul *= 128
    }
    last += delta
    starts[i] = last
    codeOf[i] = bytes[at++]!
  }

  return {
    date,
    lookup(ip) {
      const n = ipv4ToNumber(ip)
      if (n === null) return null
      let lo = 0
      let hi = count - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (starts[mid]! <= n) lo = mid
        else hi = mid - 1
      }
      const code = codes[codeOf[lo]!]
      return code && code !== '--' ? code : null
    },
  }
}

let loading: Promise<CountryTable> | null = null

export function loadCountryTable(): Promise<CountryTable> {
  loading ??= fetch(tableUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`ip-country: HTTP ${res.status}`)
      return res.arrayBuffer()
    })
    .then(parseCountryTable)
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
}
