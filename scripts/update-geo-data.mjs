#!/usr/bin/env node
// Данные для карты нод в «Блокчейн-обозревателе», вкладка «Сеть»:
//
//   - ipv4-country.bin — страна по IPv4: кому региональный регистратор выдал
//     блок адресов (сводная статистика NRO, CC BY 4.0 — подпись nro.net на
//     экране обязательна). Приложение ищет страну у себя, адреса нод никуда
//     не уходят, и работает это и под Tor;
//   - world-dots.ts — суша сеткой точек через 2° (Natural Earth, public
//     domain). Только суша, без границ: спорные границы карта не рисует;
//   - country-points.ts — где на карте ставить кружок страны (точка подписи
//     страны у Natural Earth).
//
//   node scripts/update-geo-data.mjs
//
// Раз в несколько месяцев хватает: страны у блоков адресов меняются редко.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoContains } from 'd3'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'services', 'network-map', 'data')

const NRO_URL = 'https://ftp.ripe.net/pub/stats/ripencc/nro-stats/latest/nro-delegated-stats'
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const LAND_URL = `${NE}/ne_110m_land.geojson`
const COUNTRIES_URL = `${NE}/ne_50m_admin_0_countries.geojson`

/** Шаг сетки точек суши, градусы. */
const DOT_STEP = 2

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number)
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]
}

/**
 * Формат файла (little-endian):
 *   'IPCC' · u32 дата данных ГГГГММДД · u16 число кодов N · N × 2 байта ASCII
 *   ('--' — не выдан) · u32 число диапазонов R · R × (varint шаг от начала
 *   прошлого диапазона, u8 номер кода). Диапазон длится до начала следующего.
 */
function buildCountryTable(text) {
  const header = text.slice(0, text.indexOf('\n')).split('|')
  const date = Number(header[2])
  const rows = []
  for (const line of text.split('\n')) {
    const f = line.split('|')
    if (f.length < 7 || f[2] !== 'ipv4' || f[1] === '*' || f[1] === 'ZZ' || !f[1]) continue
    if (f[6] !== 'allocated' && f[6] !== 'assigned') continue
    const start = ipv4ToInt(f[3])
    rows.push([start, start + Number(f[4]) - 1, f[1]])
  }
  rows.sort((a, b) => a[0] - b[0])

  const ranges = []
  let prevEnd = -1
  for (const [rawStart, end, code] of rows) {
    if (end <= prevEnd) continue
    const start = Math.max(rawStart, prevEnd + 1)
    if (start > prevEnd + 1) ranges.push([prevEnd + 1, '--'])
    if (ranges.at(-1)?.[1] !== code) ranges.push([start, code])
    prevEnd = end
  }
  if (prevEnd < 0xffffffff) ranges.push([prevEnd + 1, '--'])

  const codes = [...new Set(ranges.map((r) => r[1]))].sort()
  const index = new Map(codes.map((c, i) => [c, i]))
  const bytes = []
  const u32 = (v) => bytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
  bytes.push(...Buffer.from('IPCC'))
  u32(date)
  bytes.push(codes.length & 0xff, codes.length >> 8)
  for (const c of codes) bytes.push(...Buffer.from(c, 'ascii'))
  u32(ranges.length)
  let last = 0
  for (const [start, code] of ranges) {
    let d = start - last
    last = start
    for (;;) {
      const b = d % 128
      d = Math.floor(d / 128)
      if (d) bytes.push(b | 0x80)
      else {
        bytes.push(b)
        break
      }
    }
    bytes.push(index.get(code))
  }
  return { buffer: Buffer.from(bytes), date, ranges: ranges.length, codes: codes.length }
}

function buildLandDots(land) {
  const cols = 360 / DOT_STEP
  const rows = 180 / DOT_STEP
  const bits = new Uint8Array(Math.ceil((cols * rows) / 8))
  let count = 0
  for (let r = 0; r < rows; r++) {
    const lat = 90 - DOT_STEP / 2 - r * DOT_STEP
    for (let c = 0; c < cols; c++) {
      const lon = -180 + DOT_STEP / 2 + c * DOT_STEP
      if (!geoContains(land, [lon, lat])) continue
      const i = r * cols + c
      bits[i >> 3] |= 1 << (i & 7)
      count++
    }
  }
  return { base64: Buffer.from(bits).toString('base64'), cols, rows, count }
}

function buildCountryPoints(countries) {
  const points = {}
  for (const f of countries.features) {
    const p = f.properties
    const code = [p.ISO_A2, p.ISO_A2_EH, p.WB_A2].find((c) => /^[A-Z]{2}$/.test(c ?? ''))
    if (!code || points[code]) continue
    points[code] = [Math.round(p.LABEL_X * 10) / 10, Math.round(p.LABEL_Y * 10) / 10]
  }
  return points
}

const [nro, landText, countriesText] = await Promise.all([
  download(NRO_URL),
  download(LAND_URL),
  download(COUNTRIES_URL),
])

mkdirSync(OUT, { recursive: true })

const table = buildCountryTable(nro)
writeFileSync(join(OUT, 'ipv4-country.bin'), table.buffer)

const dots = buildLandDots(JSON.parse(landText))
writeFileSync(
  join(OUT, 'world-dots.ts'),
  `// Создан scripts/update-geo-data.mjs — не править руками.
// Суша сеткой ${DOT_STEP}° по Natural Earth (public domain): бит на клетку,
// строки с севера на юг, столбцы с запада на восток.
export const DOT_STEP = ${DOT_STEP}
export const DOT_COLS = ${dots.cols}
export const DOT_ROWS = ${dots.rows}
export const LAND_BITS = '${dots.base64}'
`
)

const points = buildCountryPoints(JSON.parse(countriesText))
const lines = Object.keys(points)
  .sort()
  .map((code) => `  ${code}: [${points[code][0]}, ${points[code][1]}],`)
writeFileSync(
  join(OUT, 'country-points.ts'),
  `// Создан scripts/update-geo-data.mjs — не править руками.
// Где на карте кружок страны: [долгота, широта] точки подписи у Natural
// Earth (public domain).
export const COUNTRY_POINTS: Readonly<Record<string, readonly [number, number]>> = {
${lines.join('\n')}
}
`
)

console.log(
  `ipv4-country.bin: ${table.ranges} диапазонов, ${table.codes} кодов, ${table.buffer.length} байт, данные на ${table.date}`
)
console.log(`world-dots.ts: ${dots.count} точек суши`)
console.log(`country-points.ts: ${Object.keys(points).length} стран`)
