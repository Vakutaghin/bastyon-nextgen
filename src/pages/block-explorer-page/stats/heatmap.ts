/**
 * «Когда сеть активна»: часы последней недели по дням недели и часам суток
 * (по местному времени). Час ноды — 60 блоков, он не совпадает с часом
 * календаря; относим его к тому, на который приходится его середина.
 */

import { totalOf, type StatsPoint } from './stats-model'

export interface HeatCell {
  /** 0 — понедельник. */
  weekday: number
  hour: number
  /** Транзакций в среднем за этот час (за неделю их обычно по одному). */
  value: number | null
}

export function heatmapCells(points: StatsPoint[]): HeatCell[] {
  const sums = new Map<number, { sum: number; n: number }>()
  for (const p of points) {
    const d = new Date(p.t + (p.end - p.t) / 2)
    const key = ((d.getDay() + 6) % 7) * 24 + d.getHours()
    const cell = sums.get(key) ?? { sum: 0, n: 0 }
    cell.sum += totalOf(p.counts)
    cell.n += 1
    sums.set(key, cell)
  }
  const out: HeatCell[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = sums.get(weekday * 24 + hour)
      out.push({ weekday, hour, value: cell ? cell.sum / cell.n : null })
    }
  }
  return out
}

/** Ступень насыщенности 1…8 между минимумом и максимумом недели; нет данных — 0. */
export function heatLevel(value: number | null, min: number, max: number): number {
  if (value === null) return 0
  if (max <= min) return 4
  return 1 + Math.round(((value - min) / (max - min)) * 7)
}
