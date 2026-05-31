// Форматирование дат и относительного времени

import { t } from '@/i18n'

/** Миллисекунды в минуте, часе, дне, неделе */
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/**
 * Форматирует временную метку в относительный формат:
 * "только что", "5 мин.", "2 ч.", "3 дн.", "1 нед."
 * Для дат старше недели возвращает локализованную дату.
 *
 * @param timestamp - Unix-метка времени в секундах
 * @returns отформатированная строка
 */
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const diffMs = Date.now() - date.getTime()

  const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE)
  const diffHours = Math.floor(diffMs / MS_PER_HOUR)
  const diffDays = Math.floor(diffMs / MS_PER_DAY)

  if (diffMinutes < 1) return t('appMsg.time.justNow')
  if (diffMinutes < 60) return t('appMsg.time.minutesShort', { n: diffMinutes })
  if (diffHours < 24) return t('appMsg.time.hoursShort', { n: diffHours })
  if (diffDays < 7) return t('appMsg.time.daysShort', { n: diffDays })

  return date.toLocaleDateString()
}

/**
 * Форматирует временную метку в относительный формат
 * с поддержкой входных данных в миллисекундах.
 *
 * @param timestampMs - Unix-метка времени в миллисекундах
 * @returns отформатированная строка
 */
export function formatRelativeTimeMs(timestampMs: number): string {
  return formatRelativeTime(Math.floor(timestampMs / 1000))
}

/**
 * Форматирует дату в компактный формат: "12 мар 2024".
 *
 * @param timestamp - Unix-метка времени в секундах
 * @returns отформатированная дата
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Форматирует Unix timestamp в полный формат: "12 марта, 14:30" или "12 марта 2023, 14:30".
 * Год опускается если совпадает с текущим.
 *
 * Заменяет дублированные `formatTime`, `originalAuthorFormattedTime`,
 * `formatCommentDateAndTime` из post-card, post-card-header, post-card-comments.
 *
 * @param timestamp - Unix-метка времени в секундах
 * @returns отформатированная строка с датой и временем
 */
export function formatDateTimeFull(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const isCurrentYear = date.getFullYear() === now.getFullYear()
  const time = date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const dayMonth = date.toLocaleString('ru-RU', { day: 'numeric', month: 'long' })

  if (isCurrentYear) {
    return `${dayMonth}, ${time}`
  }
  return `${dayMonth} ${date.getFullYear()}, ${time}`
}

/**
 * Форматирует миллисекундный timestamp (или строку Date) в полный формат.
 *
 * @param dateInput - строка даты или миллисекунды
 * @returns отформатированная строка
 */
export function formatDateTimeFromString(dateInput: string | number): string {
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  return formatDateTimeFull(Math.floor(date.getTime() / 1000))
}
