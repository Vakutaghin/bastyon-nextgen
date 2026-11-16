// Сетка месяца и подписи календаря. Названия месяцев и дней — из Intl по
// языку интерфейса: отдельные чанки локалей (как у antd) не нужны, и
// календарь рисуется сразу, без ожидания загрузки.
import dayjs, { type Dayjs } from 'dayjs'
import { bcp47, type Locale } from '@/i18n'

/**
 * Первый день недели: 1 — понедельник, 0 — воскресенье. Таблицей, а не
 * `Intl.Locale#weekInfo`: его нет в старых движках (Safari 15, Chromium 89).
 */
export const WEEK_START: Record<Locale, 0 | 1> = {
  ru: 1,
  en: 0,
  de: 1,
  fr: 1,
  es: 1,
  it: 1,
  sr: 1,
  kr: 0,
  zh: 1,
}

/** Дней в сетке: всегда 6 недель, как у antd, — высота панели не скачет. */
export const GRID_DAYS = 42

/** Дни сетки месяца: с начала недели, в которую попало 1-е число. */
export function monthGrid(month: Dayjs, weekStart: 0 | 1): Dayjs[] {
  const first = month.startOf('month')
  const start = first.subtract((first.day() - weekStart + 7) % 7, 'day')
  return Array.from({ length: GRID_DAYS }, (_, i) => start.add(i, 'day'))
}

/** Названия дней недели по порядку сетки: короткие («пн») и полные. */
export function weekdayNames(
  locale: Locale,
  weekStart: 0 | 1
): Array<{ short: string; long: string }> {
  const short = new Intl.DateTimeFormat(bcp47(locale), { weekday: 'short' })
  const long = new Intl.DateTimeFormat(bcp47(locale), { weekday: 'long' })
  // 1 января 2023 — воскресенье.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2023, 0, 1 + ((weekStart + i) % 7))
    return { short: short.format(date), long: long.format(date) }
  })
}

/**
 * Заголовок месяца: «нояб. 2026», «Nov 2026», «2026年11月» — без хвоста после
 * года вроде « г.», который Intl добавляет в конце. Хвост после месяца
 * («月» у китайского) — часть названия, его оставляем.
 */
export function monthTitle(month: Dayjs, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(bcp47(locale), {
    year: 'numeric',
    month: 'short',
  }).formatToParts(month.toDate())
  let last = parts.length - 1
  while (last >= 0 && parts[last]!.type === 'literal') last--
  if (parts[last]?.type !== 'year') last = parts.length - 1
  return parts
    .slice(0, last + 1)
    .map((part) => part.value)
    .join('')
}

/** Полная дата для экранного диктора: «понедельник, 16 ноября 2026 г.». */
export function dayLabeler(locale: Locale): (day: Dayjs) => string {
  const format = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (day) => format.format(day.toDate())
}

/**
 * Текст в поле. С временем — «29 сент., 11:00» (год — только если не текущий,
 * иначе поле не вмещает текст); без времени — «5 нояб. 2026 г.».
 */
export function formatField(value: Dayjs, locale: Locale, withTime: boolean): string {
  return new Intl.DateTimeFormat(
    bcp47(locale),
    withTime
      ? {
          day: 'numeric',
          month: 'short',
          year: value.year() === dayjs().year() ? undefined : 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  ).format(value.toDate())
}

/** Два знака: «07». */
export const pad2 = (n: number): string => String(n).padStart(2, '0')
