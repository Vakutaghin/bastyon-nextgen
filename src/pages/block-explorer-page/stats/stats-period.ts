/**
 * Период статистики: готовые отрезки и свой диапазон, шаг графика.
 *
 * По часам нода отдаёт не больше 7 суток от вершины цепочки
 * (getstatisticbyhours, depth ≤ 168), поэтому шаг «час» есть только у
 * периодов внутри последней недели.
 */

import { CHAIN_ANCHORS } from './chain-time'
import type { Granularity } from './stats-model'

export const DAY_MS = 86_400_000
export const HOURLY_LIMIT_MS = 7 * DAY_MS

export const PERIOD_PRESETS = ['2d', '7d', '30d', '6m', '1y', '2y', '3y', 'all'] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]

export interface PeriodRange {
  /** Начало, мс. */
  from: number
  /** Конец, мс. */
  to: number
}

/** Первый блок сети, мс. */
export const GENESIS_MS = CHAIN_ANCHORS[0]![1] * 1000

export function presetRange(preset: PeriodPreset, now: number): PeriodRange {
  const back = (days: number) => ({ from: now - days * DAY_MS, to: now })
  const months = (n: number) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - n)
    return { from: d.getTime(), to: now }
  }
  switch (preset) {
    case '2d':
      return back(2)
    case '7d':
      return back(7)
    case '30d':
      return back(30)
    case '6m':
      return months(6)
    case '1y':
      return months(12)
    case '2y':
      return months(24)
    case '3y':
      return months(36)
    case 'all':
      return { from: GENESIS_MS, to: now }
  }
}

/** Свой диапазон — целые сутки: от начала первого дня до конца последнего, не позже `now`. */
export function customRange(fromDay: number, toDay: number, now: number): PeriodRange {
  const a = new Date(Math.min(fromDay, toDay))
  a.setHours(0, 0, 0, 0)
  const b = new Date(Math.max(fromDay, toDay))
  b.setHours(0, 0, 0, 0)
  b.setDate(b.getDate() + 1)
  return { from: Math.max(GENESIS_MS, a.getTime()), to: Math.min(now, b.getTime()) }
}

/** Шаги, которые имеют смысл для периода: от 4 до примерно 400 точек. */
export function granularityOptions(range: PeriodRange, now: number): Granularity[] {
  const span = range.to - range.from
  const options: Granularity[] = []
  if (range.from >= now - HOURLY_LIMIT_MS - 3_600_000) options.push('hour')
  if (span >= 3 * DAY_MS && span <= 400 * DAY_MS) options.push('day')
  if (span >= 21 * DAY_MS) options.push('week')
  if (span >= 90 * DAY_MS) options.push('month')
  // Короткий период старше недели: по часам нода не отдаёт — хоть по суткам.
  if (!options.length) options.push('day')
  return options
}

/** Шаг по умолчанию: подробно, но не больше пары сотен точек. */
export function defaultGranularity(range: PeriodRange, now: number): Granularity {
  const options = granularityOptions(range, now)
  const span = range.to - range.from
  const preferred: Granularity =
    span <= 2.5 * DAY_MS
      ? 'hour'
      : span <= 120 * DAY_MS
        ? 'day'
        : span <= 800 * DAY_MS
          ? 'week'
          : 'month'
  return options.includes(preferred) ? preferred : options[0]!
}
