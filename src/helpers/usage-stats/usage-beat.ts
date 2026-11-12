/**
 * Анонимная статистика использования — расчёты без побочных эффектов.
 *
 * Сутки делятся на 15-минутки. Если в 15-минутке приложением пользовались,
 * уходит одна отметка: версия, платформа и четыре флага — «первая за сутки,
 * неделю, месяц, вообще». Идентификатора нет, поэтому две отметки одного
 * устройства между собой не связать. Сервер только прибавляет счётчики
 * «15-минутка × платформа × версия» (stats-server/server.py), и из них
 * выходят активные устройства по времени, за сутки, неделю и месяц, часы
 * использования и новые установки.
 *
 * Сутки, неделя и месяц — по Москве (UTC+3, без летнего времени), как их
 * показывает админка: иначе «первая за сутки» не совпала бы с сутками графика.
 */

/** Отрезок, за который уходит не больше одной отметки. */
export const SLOT_MS = 15 * 60 * 1000

const STATS_TZ_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type UsagePlatform = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web'

/** Что устройство помнит о прошлой отправленной отметке — только номера отрезков. */
export interface UsageBeatState {
  /** Номер 15-минутки от начала эпохи. */
  slot: number
  /** Сутки, `2026-11-12`. */
  day: string
  /** ISO-неделя, `2026-W46`. */
  week: string
  /** Месяц, `2026-11`. */
  month: string
}

export interface UsageBeat {
  state: UsageBeatState
  /** Первая отметка за сутки, неделю, месяц и первая вообще. */
  flags: { d: boolean; w: boolean; m: boolean; n: boolean }
}

export function slotOf(nowMs: number): number {
  return Math.floor(nowMs / SLOT_MS)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Сутки, ISO-неделя и месяц момента — по московскому времени. */
export function periodKeys(nowMs: number): Pick<UsageBeatState, 'day' | 'week' | 'month'> {
  const local = new Date(nowMs + STATS_TZ_OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = `${year}-${pad(local.getUTCMonth() + 1)}`
  const day = `${month}-${pad(local.getUTCDate())}`

  // ISO-неделя: неделя, в которую попал четверг, — та, что содержит этот день.
  const midnight = Date.UTC(year, local.getUTCMonth(), local.getUTCDate())
  const weekday = local.getUTCDay() || 7
  const thursday = new Date(midnight + (4 - weekday) * DAY_MS)
  const isoYear = thursday.getUTCFullYear()
  const week = Math.ceil(((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / DAY_MS + 1) / 7)

  return { day, week: `${isoYear}-W${pad(week)}`, month }
}

/**
 * Отметка, которую пора отправить, или `null`, если в этой 15-минутке она уже
 * ушла. Флаги считаются от прошлой удачной отправки.
 */
export function nextBeat(prev: UsageBeatState | null, nowMs: number): UsageBeat | null {
  const slot = slotOf(nowMs)
  if (prev && prev.slot >= slot) return null
  const keys = periodKeys(nowMs)
  return {
    state: { slot, ...keys },
    flags: {
      d: prev?.day !== keys.day,
      w: prev?.week !== keys.week,
      m: prev?.month !== keys.month,
      n: prev === null,
    },
  }
}

/** Адрес отметки: всё в строке запроса, тела и заголовков нет. */
export function beatUrl(
  base: string,
  beat: UsageBeat,
  version: string,
  platform: UsagePlatform
): string {
  const bit = (b: boolean): string => (b ? '1' : '0')
  const params = new URLSearchParams({
    v: version,
    p: platform,
    d: bit(beat.flags.d),
    w: bit(beat.flags.w),
    m: bit(beat.flags.m),
    n: bit(beat.flags.n),
  })
  return `${base}?${params.toString()}`
}

/** Где запущено приложение: программа для компьютера, для телефона или сайт. */
export type UsageRuntime = 'desktop' | 'mobile' | 'web'

/** Только то, что нужно отличать: тип устройства, без версии системы и модели. */
export function detectPlatform(userAgent: string, runtime: UsageRuntime): UsagePlatform {
  if (runtime === 'desktop') {
    if (/Windows/i.test(userAgent)) return 'windows'
    if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macos'
    return 'linux'
  }
  if (runtime === 'mobile') return /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : 'android'
  return 'web'
}

/** Сохранённое состояние: всё, что не похоже на него, — как будто отметок не было. */
export function parseBeatState(raw: unknown): UsageBeatState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.slot !== 'number' ||
    !Number.isFinite(r.slot) ||
    typeof r.day !== 'string' ||
    typeof r.week !== 'string' ||
    typeof r.month !== 'string'
  ) {
    return null
  }
  return { slot: r.slot, day: r.day, week: r.week, month: r.month }
}
