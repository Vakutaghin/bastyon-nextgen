// Форматирование дат и относительного времени

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

  if (diffMinutes < 1) return 'только что'
  if (diffMinutes < 60) return `${diffMinutes} мин.`
  if (diffHours < 24) return `${diffHours} ч.`
  if (diffDays < 7) return `${diffDays} дн.`

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
