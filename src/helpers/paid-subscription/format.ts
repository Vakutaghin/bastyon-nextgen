/** Подписи сумм и сроков платной подписки. */

import { dateLocale } from '@/helpers/common/date-formatter'
import { SATOSHI } from './plans'

/** Сатоши → «5,5»-подобная строка PKOIN без хвостовых нулей (до 8 знаков). */
export function formatPkoin(satoshi: number): string {
  const value = satoshi / SATOSHI
  return value.toLocaleString(dateLocale(), { maximumFractionDigits: 8 })
}

/** «12 ноября», а не в этом году — «12 ноября 2027 г.». */
export function formatTermDate(unixSeconds: number, now = Date.now()): string {
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) return ''
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
