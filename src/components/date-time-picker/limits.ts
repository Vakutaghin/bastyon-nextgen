// Что календарь не даёт выбрать: всё раньше первой допустимой минуты.
import dayjs, { type Dayjs } from 'dayjs'

/** Первая целая минута после `min` (unix-секунды): с неё можно выбирать. */
export function firstAllowedMinute(min: number): Dayjs {
  return dayjs.unix(min).add(1, 'minute').startOf('minute')
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i)
}

/** Часы и минуты дня `day`, которые раньше `first`: календарь их выключает. */
export function minuteLimits(
  day: Dayjs | null,
  first: Dayjs | null
): { hours: number[]; minutes: (hour: number) => number[] } {
  if (!day || !first || !day.isSame(first, 'day')) return { hours: [], minutes: () => [] }
  const hour = first.hour()
  return {
    hours: range(0, hour),
    minutes: (h) => (h < hour ? range(0, 60) : h === hour ? range(0, first.minute()) : []),
  }
}
