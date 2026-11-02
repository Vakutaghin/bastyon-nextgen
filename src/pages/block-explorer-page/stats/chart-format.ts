/**
 * Подписи графиков статистики: даты по шагу графика и числа — по правилам
 * языка интерфейса.
 */

import { bcp47 } from '@/i18n'
import type { Granularity } from './stats-model'

const DAY_MS = 86_400_000

function fmt(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(bcp47(locale), options)
}

/** Период точки целиком — для подсказки и таблицы. */
export function formatPeriod(t: number, end: number, g: Granularity, locale: string): string {
  switch (g) {
    case 'hour':
      return fmt(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(t)
    case 'day':
      return fmt(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(t)
    case 'week': {
      const range = fmt(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) as Intl.DateTimeFormat & {
        formatRange(from: number, to: number): string
      }
      return range.formatRange(t, end - DAY_MS)
    }
    case 'month':
      return fmt(locale, { month: 'long', year: 'numeric' }).format(t)
  }
}

/** Подпись деления оси времени: чем длиннее видимый отрезок, тем крупнее единица. */
export function axisTimeFormatter(spanMs: number, locale: string): (d: Date) => string {
  if (spanMs <= 2.5 * DAY_MS) {
    const time = fmt(locale, { hour: '2-digit', minute: '2-digit' })
    const date = fmt(locale, { day: 'numeric', month: 'short' })
    return (d) => (d.getHours() === 0 ? date.format(d) : time.format(d))
  }
  if (spanMs <= 200 * DAY_MS) {
    const date = fmt(locale, { day: 'numeric', month: 'short' })
    return (d) => date.format(d)
  }
  if (spanMs <= 3 * 366 * DAY_MS) {
    const month = fmt(locale, { month: 'short' })
    const year = fmt(locale, { year: 'numeric' })
    return (d) => (d.getMonth() === 0 ? year.format(d) : month.format(d))
  }
  const year = fmt(locale, { year: 'numeric' })
  return (d) => year.format(d)
}

/** Деления оси значений: 0, 1,2 тыс., 15 тыс. */
export function formatCompact(value: number, locale: string, digits = 1): string {
  return new Intl.NumberFormat(bcp47(locale), {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Подписи делений — столько знаков, чтобы соседние не совпадали: у оси не от
 * нуля (18,76 и 18,78 млн) один знак давал одинаковые «18,8 млн».
 */
export function formatTicks(values: readonly number[], locale: string): string[] {
  let labels: string[] = []
  for (let digits = 1; digits <= 4; digits++) {
    labels = values.map((v) => formatCompact(v, locale, digits))
    if (new Set(labels).size === labels.length) break
  }
  return labels
}

/** Значение в подсказке и таблице: с разрядами, дробь — до `digits` знаков. */
export function formatValue(value: number | null, locale: string, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(bcp47(locale), {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : digits,
  }).format(value)
}
