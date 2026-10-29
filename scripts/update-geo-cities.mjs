#!/usr/bin/env node
// Таблица «IPv4 → место на карте» для вкладки «Сеть» «Блокчейн-обозревателя»:
// раскладка «Карта» ставит ноду в её город. Данные — DB-IP IP to City Lite
// (CC BY 4.0, подпись db-ip.com на экране обязательна).
//
// Таблица весит ~4 МБ, поэтому в установщик не входит: приложение скачивает
// её целиком с GitHub, когда открывают карту, и хранит у себя. Адреса нод
// никуда не уходят — ищет оно у себя, как и страну (update-geo-data.mjs).
//
//   node scripts/update-geo-cities.mjs
//
// Результат — geo-data/ipv4-city.bin.gz; приложение берёт его из ветки main.
// Обновлять раз в несколько месяцев, вместе с update-geo-data.mjs.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { createGunzip, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'geo-data')

/** Точность места: 0,1° — около 11 км. */
const GRID = 10
/** Соседние блоки ближе этого — одно место: таблица меньше, на карте не видно. */
const MERGE_KM = 25

function monthUrl(date) {
  const m = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  return { month: m, url: `https://download.db-ip.com/free/dbip-city-lite-${m}.csv.gz` }
}

/** Файл выходит в начале месяца: если нового ещё нет — берём прошлый. */
async function openCsv() {
  const now = new Date()
  for (const back of [0, 1]) {
    const { month, url } = monthUrl(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    )
    const res = await fetch(url)
    if (res.ok) return { month, body: Readable.fromWeb(res.body).pipe(createGunzip()) }
  }
  throw new Error('db-ip: нет файла ни за этот, ни за прошлый месяц')
}

function csvFields(line) {
  const fields = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      fields.push(cur)
      cur = ''
    } else cur += ch
  }
  fields.push(cur)
  return fields
}

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number)
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]
}

const RAD = Math.PI / 180
function distanceKm([lat1, lon1], [lat2, lon2]) {
  const h =
    Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}

/**
 * Формат (little-endian), до сжатия gzip:
 *   'IPGC' · u8 версия формата (1) · u32 дата данных ГГГГММДД · u32 число
 *   мест L · L × (i16 широта×100, i16 долгота×100) — частые первыми · u32
 *   число диапазонов R · R × (varint шаг в блоках /24 от начала прошлого
 *   диапазона, varint номер места + 1; 0 — место неизвестно). Диапазон длится
 *   до начала следующего.
 */
async function build() {
  const { month, body } = await openCsv()
  const ranges = []
  let rep = null
  for await (const line of createInterface({ input: body })) {
    if (line.includes(':')) continue
    const f = csvFields(line)
    if (f.length < 8) continue
    const block = Math.floor(ipv4ToInt(f[0]) / 256)
    const lat = Math.round(Number(f[6]) * GRID) / GRID
    const lon = Math.round(Number(f[7]) * GRID) / GRID
    const known = f[3] !== 'ZZ' && Number.isFinite(lat) && Number.isFinite(lon)
    const loc = known ? [lat, lon] : null
    if (rep === loc) continue
    if (rep && loc && distanceKm(rep, loc) < MERGE_KM) continue
    // Несколько диапазонов внутри одного /24 — место по последнему.
    if (ranges.at(-1)?.[0] === block) ranges.pop()
    if (ranges.length && ranges.at(-1)[1]?.join() === loc?.join()) {
      rep = ranges.at(-1)[1]
      continue
    }
    ranges.push([block, loc])
    rep = loc
  }

  const uses = new Map()
  for (const [, loc] of ranges) if (loc) uses.set(loc.join(), (uses.get(loc.join()) ?? 0) + 1)
  const places = [...uses.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const index = new Map(places.map((k, i) => [k, i + 1]))

  const bytes = []
  const u32 = (v) => bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
  const i16 = (v) => bytes.push(v & 0xff, (v >> 8) & 0xff)
  const varint = (v) => {
    for (;;) {
      const b = v % 128
      v = Math.floor(v / 128)
      if (v) bytes.push(b | 0x80)
      else return bytes.push(b)
    }
  }
  bytes.push(...Buffer.from('IPGC'), 1)
  u32(Number(month.replace('-', '')) * 100 + 1)
  u32(places.length)
  for (const key of places) {
    const [lat, lon] = key.split(',').map(Number)
    i16(Math.round(lat * 100))
    i16(Math.round(lon * 100))
  }
  u32(ranges.length)
  let last = 0
  for (const [block, loc] of ranges) {
    varint(block - last)
    last = block
    varint(loc ? index.get(loc.join()) : 0)
  }
  return {
    month,
    buffer: gzipSync(Buffer.from(bytes), { level: 9 }),
    ranges: ranges.length,
    places: places.length,
  }
}

const table = await build()
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'ipv4-city.bin.gz'), table.buffer)
console.log(
  `ipv4-city.bin.gz: ${table.ranges} диапазонов, ${table.places} мест, ${table.buffer.length} байт, DB-IP за ${table.month}`
)
