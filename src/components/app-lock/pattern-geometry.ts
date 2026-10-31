// Геометрия графического ключа: поле 0…300, точки 0–8 по строкам, центр
// точки — середина клетки 100×100.

export interface Point {
  x: number
  y: number
}

export const DOT_CENTER: readonly Point[] = Array.from({ length: 9 }, (_, i) => ({
  x: 50 + (i % 3) * 100,
  y: 50 + Math.floor(i / 3) * 100,
}))

/**
 * Радиус попадания — треть клетки без малого. Ход конём (0→5) проходит в 45
 * от соседних точек и их не задевает.
 */
export const HIT_RADIUS = 30

/** Ещё не соединённые точки, которые задевает отрезок a→b, — по порядку вдоль него. */
export function hitsAlong(a: Point, b: Point, visited: readonly number[]): number[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const hits: Array<{ dot: number; t: number }> = []
  for (let dot = 0; dot < 9; dot++) {
    if (visited.includes(dot)) continue
    const c = DOT_CENTER[dot]!
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2))
    const px = a.x + t * dx - c.x
    const py = a.y + t * dy - c.y
    if (px * px + py * py <= HIT_RADIUS * HIT_RADIUS) hits.push({ dot, t })
  }
  return hits.sort((p, q) => p.t - q.t).map((h) => h.dot)
}

/** Точка ровно посередине между a и b (0 и 2 → 1, 0 и 8 → 4); нет такой — null. */
function middleOf(a: number, b: number): number | null {
  const ra = Math.floor(a / 3)
  const ca = a % 3
  const rb = Math.floor(b / 3)
  const cb = b % 3
  if ((ra + rb) % 2 !== 0 || (ca + cb) % 2 !== 0) return null
  const mid = ((ra + rb) / 2) * 3 + (ca + cb) / 2
  return mid === a || mid === b ? null : mid
}

/**
 * Что добавить к ключу: новые точки по порядку, а перед каждой — пропущенную
 * середину, если линия прошла через неё (как в Android: 0→2 даёт 0, 1, 2).
 */
export function withPassThrough(sequence: readonly number[], dots: readonly number[]): number[] {
  const out: number[] = []
  const seen = new Set(sequence)
  let prev = sequence[sequence.length - 1]
  for (const dot of dots) {
    if (seen.has(dot)) continue
    if (prev !== undefined) {
      const mid = middleOf(prev, dot)
      if (mid !== null && !seen.has(mid)) {
        out.push(mid)
        seen.add(mid)
      }
    }
    out.push(dot)
    seen.add(dot)
    prev = dot
  }
  return out
}
