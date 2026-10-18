/**
 * Раскладка нескольких картинок поста — как у альбомов ВКонтакте и Telegram:
 * сетка всегда во всю ширину, высота — по пропорциям самих картинок.
 *
 * Перебираем варианты — ряды разной длины, а для 3–4 картинок ещё «первая
 * большая слева, остальные столбиком справа» — и берём тот, где картинки
 * меньше всего обрезаны, сетка ближе к квадрату и нет мелких плиток. Первая
 * картинка получает больше места: ряды с меньшим числом картинок — выше.
 *
 * Координаты — в долях ширины сетки: ширина = 1, высота = `height`.
 */

export interface GridTile {
  x: number
  y: number
  w: number
  h: number
}

export interface GridLayout {
  /** Высота сетки в долях её ширины. */
  height: number
  tiles: GridTile[]
}

/** Больше в сетке не показываем: на последней плитке — «+N». */
export const GRID_MAX_IMAGES = 10

/** Сетка не выше своей ширины. */
const MAX_HEIGHT = 1
/** Уже — картинку в плитке не разглядеть. */
const MIN_TILE_WIDTH = 0.2
/** Плитка меньше — штраф: лучше меньше картинок в ряду. */
const SMALL_TILE = 0.3
/** Крайние пропорции (панорама, скриншот) считаем по этим границам — дальше обрезка. */
const RATIO_MIN = 0.4
const RATIO_MAX = 2.5
const MAX_PER_ROW = 4
const MAX_ROWS = 4

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

function safeRatio(r: number | undefined): number {
  return r && Number.isFinite(r) && r > 0 ? r : 1
}

/** Ширины плиток ряда по пропорциям, не уже MIN_TILE_WIDTH, в сумме 1. */
function rowWidths(ratios: number[]): number[] {
  const total = ratios.reduce((s, r) => s + r, 0)
  const widths = ratios.map((r) => r / total)
  const narrow = widths.filter((w) => w < MIN_TILE_WIDTH)
  if (!narrow.length || MIN_TILE_WIDTH * ratios.length > 1) return widths
  const fixed = narrow.length * MIN_TILE_WIDTH
  const restTotal = widths.filter((w) => w >= MIN_TILE_WIDTH).reduce((s, w) => s + w, 0)
  return widths.map((w) => (w < MIN_TILE_WIDTH ? MIN_TILE_WIDTH : (w / restTotal) * (1 - fixed)))
}

/** Все разбиения n картинок на ряды по 1..MAX_PER_ROW, не больше MAX_ROWS рядов. */
function rowCompositions(n: number): number[][] {
  const out: number[][] = []
  const walk = (left: number, acc: number[]): void => {
    if (left === 0) {
      out.push(acc)
      return
    }
    if (acc.length === MAX_ROWS) return
    for (let k = 1; k <= Math.min(MAX_PER_ROW, left); k++) walk(left - k, [...acc, k])
  }
  walk(n, [])
  return out
}

function rowsLayout(ratios: number[], counts: number[]): GridLayout {
  const rows: Array<{ ratios: number[]; height: number }> = []
  let i = 0
  for (const c of counts) {
    const row = ratios.slice(i, i + c)
    rows.push({ ratios: row, height: 1 / row.reduce((s, r) => s + r, 0) })
    i += c
  }
  const natural = rows.reduce((s, row) => s + row.height, 0)
  // Выше квадрата — сжимаем все ряды поровну, картинки обрежутся по бокам.
  const scale = natural > MAX_HEIGHT ? MAX_HEIGHT / natural : 1
  const tiles: GridTile[] = []
  let y = 0
  for (const row of rows) {
    const h = row.height * scale
    let x = 0
    for (const w of rowWidths(row.ratios)) {
      tiles.push({ x, y, w, h })
      x += w
    }
    y += h
  }
  return { height: y, tiles }
}

/** Первая — большая слева, остальные столбиком справа. */
function columnLayout(ratios: number[]): GridLayout {
  const main = ratios[0] ?? 1
  const rest = ratios.slice(1)
  const inv = rest.reduce((s, r) => s + 1 / r, 0)
  // Ширина столбца, при которой обе стороны одной высоты и ничего не обрезано.
  const col = clamp(1 / (1 + main * inv), 0.25, 0.5)
  const height = Math.min(MAX_HEIGHT, ((1 - col) / main + col * inv) / 2)
  const tiles: GridTile[] = [{ x: 0, y: 0, w: 1 - col, h: height }]
  let y = 0
  for (const r of rest) {
    const h = (height * (1 / r)) / inv
    tiles.push({ x: 1 - col, y, w: col, h })
    y += h
  }
  return { height, tiles }
}

/** Насколько вариант хуже идеала: обрезка, пустота, мелкие плитки. Меньше — лучше. */
function score(layout: GridLayout, ratios: number[], counts?: number[]): number {
  let area = 0
  let cropped = 0
  let small = 0
  layout.tiles.forEach((t, i) => {
    const shown = t.w / t.h
    const r = ratios[i] ?? 1
    const loss = 1 - Math.min(shown / r, r / shown)
    const a = t.w * t.h
    area += a
    cropped += a * loss
    const side = Math.min(t.w, t.h)
    if (side < SMALL_TILE) small += (SMALL_TILE - side) * 0.5
  })
  let penalty = cropped / area + small + Math.abs(MAX_HEIGHT - layout.height) * 0.3
  // Ряд с большим числом картинок над рядом с меньшим: первая картинка мельчает.
  if (counts) {
    counts.forEach((c, i) => {
      if (i > 0 && (counts[i - 1] ?? 0) > c) penalty += 0.08
    })
  }
  return penalty
}

/**
 * Раскладка для `ratios` (ширина/высота каждой картинки; неизвестная — 1).
 * Картинок больше GRID_MAX_IMAGES — раскладываются первые GRID_MAX_IMAGES.
 */
export function layoutImageGrid(ratios: Array<number | undefined>): GridLayout {
  const real = ratios.slice(0, GRID_MAX_IMAGES).map(safeRatio)
  const n = real.length
  if (n === 0) return { height: 0, tiles: [] }
  const layoutRatios = real.map((r) => clamp(r, RATIO_MIN, RATIO_MAX))
  if (n === 1) {
    const h = Math.min(MAX_HEIGHT, 1 / (layoutRatios[0] ?? 1))
    return { height: h, tiles: [{ x: 0, y: 0, w: 1, h }] }
  }

  let best: GridLayout | null = null
  let bestScore = Infinity
  const consider = (layout: GridLayout, counts?: number[]): void => {
    const s = score(layout, real, counts)
    if (s < bestScore - 1e-9) {
      best = layout
      bestScore = s
    }
  }
  for (const counts of rowCompositions(n)) consider(rowsLayout(layoutRatios, counts), counts)
  if (n === 3 || n === 4) consider(columnLayout(layoutRatios))
  return best ?? rowsLayout(layoutRatios, [n])
}
