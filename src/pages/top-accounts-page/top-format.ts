/**
 * Числа топа аккаунтов по правилам языка интерфейса (Intl): «152 337,1»,
 * «1,2 тыс.».
 */

import { dateLocale } from '@/helpers/common/date-formatter'

const formats = new Map<string, Intl.NumberFormat>()

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${dateLocale()}|${JSON.stringify(options)}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(dateLocale(), options)
    formats.set(key, format)
  }
  return format
}

/** Репутация: целые с группами разрядов и один знак после запятой, если он есть. */
export const formatTopReputation = (value: number): string =>
  numberFormat({ maximumFractionDigits: 1 }).format(value)

/** Подписчики и посты — коротко: «1,2 тыс.». */
export const formatTopCount = (value: number): string =>
  numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(value)

/** Год регистрации из `regdate` профиля (секунды); 0 — неизвестен. */
export function registrationYear(regdate: number | undefined): number {
  return regdate && regdate > 0 ? new Date(regdate * 1000).getFullYear() : 0
}
