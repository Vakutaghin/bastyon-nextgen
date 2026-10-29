// Страна по IPv4 из встроенной таблицы: формат scripts/update-geo-data.mjs,
// поиск по диапазонам, частные адреса и IPv6 — без страны.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ipv4ToNumber, parseCountryTable } from './ip-country'

/** Таблица того же формата, что пишет скрипт: начала диапазонов и коды. */
function table(date: number, ranges: Array<[string, string]>): ArrayBuffer {
  const codes = [...new Set(ranges.map(([, code]) => code))].sort()
  const bytes: number[] = [...'IPCC'].map((c) => c.charCodeAt(0))
  const u32 = (v: number) => bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, v >>> 24)
  u32(date)
  bytes.push(codes.length & 0xff, codes.length >> 8)
  codes.forEach((c) => bytes.push(c.charCodeAt(0), c.charCodeAt(1)))
  u32(ranges.length)
  let last = 0
  for (const [start, code] of ranges) {
    let d = ipv4ToNumber(start)! - last
    last += d
    for (;;) {
      const b = d % 128
      d = Math.floor(d / 128)
      if (d) bytes.push(b | 0x80)
      else {
        bytes.push(b)
        break
      }
    }
    bytes.push(codes.indexOf(code))
  }
  return new Uint8Array(bytes).buffer
}

describe('ip-country', () => {
  const t = parseCountryTable(
    table(20261028, [
      ['0.0.0.0', '--'],
      ['5.0.0.0', 'DE'],
      ['5.9.0.0', 'RU'],
      ['10.0.0.0', '--'],
      ['11.0.0.0', 'US'],
    ])
  )

  it('дата данных и страна по диапазону, включая границы', () => {
    expect(t.date).toBe('2026-10-28')
    expect(t.lookup('5.0.0.0')).toBe('DE')
    expect(t.lookup('5.8.255.255')).toBe('DE')
    expect(t.lookup('5.9.0.0')).toBe('RU')
    expect(t.lookup('255.255.255.255')).toBe('US')
  })

  it('частные и не выданные адреса, IPv6 и мусор — страна неизвестна', () => {
    expect(t.lookup('10.1.2.3')).toBeNull()
    expect(t.lookup('1.2.3.4')).toBeNull()
    expect(t.lookup('2a01:4f8::1')).toBeNull()
    expect(t.lookup('300.1.1.1')).toBeNull()
    expect(t.lookup('::ffff:5.9.1.1')).toBe('RU')
  })

  it('чужой файл — ошибка, а не тихая чепуха', () => {
    expect(() => parseCountryTable(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)).toThrow()
  })

  it('встроенная таблица читается и знает крупные сети', () => {
    const file = readFileSync(resolve(__dirname, 'data/ipv4-country.bin'))
    const real = parseCountryTable(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
    )
    expect(real.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Блоки Hetzner (Германия) и Ростелекома.
    expect(real.lookup('5.9.0.1')).toBe('DE')
    expect(real.lookup('95.31.45.162')).toBe('RU')
    expect(real.lookup('192.168.1.1')).toBeNull()
  })
})
