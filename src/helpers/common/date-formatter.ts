// Даты и время — один модуль на всё приложение (S71).
//
// Раньше форматтеров было восемь: половина жёстко брала 'ru-RU' (в английском
// интерфейсе даты оставались русскими), часть — язык браузера вместо языка
// интерфейса, а относительное время склонялось неправильно («3 год назад»).
// Здесь всё идёт через Intl с языком интерфейса; склонения делает
// Intl.RelativeTimeFormat, а не наши ключи.

import { i18n, t } from '@/i18n'

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3_600
const SECONDS_PER_DAY = 86_400
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY

/** Порог «только что» для полного относительного времени (секунды). */
const JUST_NOW_SECONDS = 5

/** Единицы полного относительного времени, от крупной к мелкой. */
const TIME_AGO_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * SECONDS_PER_DAY],
  ['month', 30 * SECONDS_PER_DAY],
  ['day', SECONDS_PER_DAY],
  ['hour', SECONDS_PER_HOUR],
  ['minute', SECONDS_PER_MINUTE],
  ['second', 1],
]

/**
 * Язык дат — язык интерфейса ('ru' / 'en'). Чтение ref'а внутри render или
 * computed подписывает их на смену языка.
 */
export function dateLocale(): string {
  return String(i18n.global.locale.value)
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function validDate(ms: number): Date | null {
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Полное относительное время с правильным склонением: «2 минуты назад»,
 * «3 года назад», «5 days ago». До пяти секунд — «только что».
 *
 * @param unixSeconds - метка времени в секундах
 * @param now - «сейчас» в секундах (для тестов и списков с общим тиком)
 */
export function formatTimeAgo(unixSeconds: number, now: number = nowSeconds()): string {
  const diff = now - unixSeconds
  if (diff < JUST_NOW_SECONDS) return t('appMsg.relativeAgo.justNow')
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'always' })
  for (const [unit, seconds] of TIME_AGO_UNITS) {
    if (diff >= seconds) return rtf.format(-Math.floor(diff / seconds), unit)
  }
  return t('appMsg.relativeAgo.justNow')
}

/**
 * Короткое время для плотных списков: «только что», «5 мин.», «2 ч.», «3 дн.»;
 * старше недели — дата. Сокращения не склоняются, поэтому идут из словаря.
 *
 * @param unixSeconds - метка времени в секундах
 */
export function formatTimeCompact(unixSeconds: number, now: number = nowSeconds()): string {
  const diff = now - unixSeconds
  if (diff < SECONDS_PER_MINUTE) return t('appMsg.time.justNow')
  if (diff < SECONDS_PER_HOUR) {
    return t('appMsg.time.minutesShort', { n: Math.floor(diff / SECONDS_PER_MINUTE) })
  }
  if (diff < SECONDS_PER_DAY) {
    return t('appMsg.time.hoursShort', { n: Math.floor(diff / SECONDS_PER_HOUR) })
  }
  if (diff < SECONDS_PER_WEEK) {
    return t('appMsg.time.daysShort', { n: Math.floor(diff / SECONDS_PER_DAY) })
  }
  return new Date(unixSeconds * 1000).toLocaleDateString(dateLocale())
}

/**
 * Дата и время поста или комментария: «12 марта, 14:30», год — только если
 * не текущий: «12 марта 2023, 14:30».
 *
 * @param unixSeconds - метка времени в секундах
 */
export function formatDateTimeFull(unixSeconds: number): string {
  if (!unixSeconds) return ''
  const date = validDate(unixSeconds * 1000)
  if (!date) return ''

  const locale = dateLocale()
  const isCurrentYear = date.getFullYear() === new Date().getFullYear()
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  })
  return `${day}, ${time}`
}

/**
 * То же, что formatDateTimeFull, но на входе строка даты или миллисекунды.
 */
export function formatDateTimeFromString(dateInput: string | number): string {
  const date = validDate(new Date(dateInput).getTime())
  if (!date) return ''
  return formatDateTimeFull(Math.floor(date.getTime() / 1000))
}

/**
 * Точная метка для эксплорера: дата и время до секунд в числовом виде.
 *
 * @param unixSeconds - метка времени в секундах
 */
export function formatDateTimeExact(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(dateLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Часы и минуты: «14:30» / «02:30 PM». */
export function formatClock(ms: number): string {
  const date = validDate(ms)
  return date ? date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
}

/** Дата без времени: «12 марта 2024 г.» / «March 12, 2024». */
export function formatLongDate(ms: number): string {
  const date = validDate(ms)
  return date
    ? date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
}

/** Дата и время целиком, по правилам языка: для карточек с подробностями. */
export function formatDateTimeMedium(ms: number): string {
  const date = validDate(ms)
  return date ? date.toLocaleString(dateLocale()) : ''
}
