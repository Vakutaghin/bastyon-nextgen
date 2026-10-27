/**
 * Числа, даты, размеры и время просмотра «Медиастудии» — по правилам языка
 * интерфейса (Intl): «1,2 тыс.», «16 МБ», «3 ч 5 мин».
 */

import { dateLocale } from '@/helpers/common/date-formatter'

const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = dateLocale()
  const key = `${locale}|${JSON.stringify(options)}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format
}

/** Число целиком: «12 345». */
export const formatCount = (value: number): string => numberFormat().format(value)

/** Число коротко для плиток: «1,2 тыс.», «3,4 млн». */
export const formatCompact = (value: number): string =>
  numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(value)

/** Дата загрузки в списке: «12 окт. 2026 г.». */
export function formatStudioDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Дата и время в окне ролика: «20 октября 2026 г., 14:00». */
export function formatStudioDateTime(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString(dateLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Размер файла: «850 КБ», «16 МБ», «1,2 ГБ». */
export function formatSize(bytes: number): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return numberFormat({
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0,
  }).format(value)
}

const unitFormat = (unit: 'hour' | 'minute' | 'second', value: number): string =>
  numberFormat({ style: 'unit', unit, unitDisplay: 'short' }).format(value)

/** Время просмотра: «3 ч 5 мин», «4 мин 10 с», «12 с». */
export function formatWatchTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours)
    return [unitFormat('hour', hours), minutes && unitFormat('minute', minutes)]
      .filter(Boolean)
      .join(' ')
  if (minutes)
    return [unitFormat('minute', minutes), secs && unitFormat('second', secs)]
      .filter(Boolean)
      .join(' ')
  return unitFormat('second', secs)
}
