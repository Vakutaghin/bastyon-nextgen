/**
 * Геометрия графиков статистики: круглые деления оси, какие подписи по X
 * поместятся, столбик со скруглённой вершиной.
 */

/** Деления оси Y от нуля: шаг 1, 2 или 5 × 10ⁿ, не дробный у целых величин. */
export function niceTicks(max: number, count = 4, integer = true): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power
  const clean = integer ? Math.max(1, Math.ceil(step)) : step
  const ticks: number[] = []
  for (let value = 0; value < max + clean; value += clean) {
    ticks.push(Number(value.toPrecision(12)))
    if (value >= max) break
  }
  return ticks
}

/**
 * Какие точки подписать по X: первая, последняя и поровну между ними — столько,
 * сколько влезет при `minGap` пикселей на подпись.
 */
export function labelIndexes(length: number, width: number, minGap = 88): number[] {
  if (length <= 0) return []
  if (length === 1) return [0]
  const slots = Math.max(2, Math.min(length, Math.floor(width / minGap)))
  const indexes = new Set<number>()
  for (let i = 0; i < slots; i++) indexes.add(Math.round((i * (length - 1)) / (slots - 1)))
  return [...indexes].sort((a, b) => a - b)
}

/** Столбик: скругление 4 px сверху, у основания — прямой угол. */
export function columnPath(x: number, width: number, top: number, base: number): string {
  const height = base - top
  if (height <= 0 || width <= 0) return ''
  const r = Math.min(4, width / 2, height)
  return [
    `M${x},${base}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${base}`,
    'Z',
  ].join(' ')
}

/** Строк в таблице под графиком удержания: каждая секунда — слишком много. */
export function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  return labelIndexes(items.length, count * 88).map((i) => items[i]!)
}
