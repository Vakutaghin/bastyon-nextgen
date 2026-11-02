/**
 * Модель статистики сети: корзины ноды → точки графика → серии.
 *
 * `getstatisticbyhours` / `getstatisticbydays` отдают по корзине (час или
 * сутки по высоте блока) число транзакций каждого типа. Нода считает только
 * типы 1, 100, 103, 104, 200–212, 220, 300–303 (ExplorerRepository,
 * pocketnet.core 0.22): отписок, блокировок и модерации в статистике нет —
 * поэтому и серии «Модерация» нет. Текущие сутки (час) нода не отдаёт: они
 * ещё не закончились.
 */

import { dayToTime, hourToTime, type ChainAnchor } from './chain-time'

/** Тип транзакции → сколько их в корзине. */
export type Counts = Record<string, number>
/** Номер корзины ноды → разбивка по типам. */
export type Buckets = Record<string, Counts>

export type Granularity = 'hour' | 'day' | 'week' | 'month'
export type BucketKind = 'hour' | 'day'

export interface StatsPoint {
  /** Начало периода, мс. */
  t: number
  /** Начало следующего периода, мс. */
  end: number
  counts: Counts
  /** Сколько корзин ноды вошло: у недели и месяца по краям их бывает меньше. */
  parts: number
}

/** Точка, готовая для графика: значения серий по ключу. */
export interface ChartPoint {
  t: number
  end: number
  values: Record<string, number | null>
}

function cleanCounts(raw: unknown): Counts {
  const out: Counts = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [type, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) out[type] = n
  }
  return out
}

/** Корзины ноды → точки по возрастанию времени. */
export function bucketsToPoints(
  buckets: Buckets | null | undefined,
  kind: BucketKind,
  tip?: ChainAnchor | null
): StatsPoint[] {
  if (!buckets || typeof buckets !== 'object') return []
  const toTime = kind === 'hour' ? hourToTime : dayToTime
  return Object.keys(buckets)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((n) => ({
      t: toTime(n, tip),
      end: toTime(n + 1, tip),
      counts: cleanCounts(buckets[String(n)]),
      parts: 1,
    }))
}

/** Начало календарного периода (по местному времени), в который входит `ms`. */
export function periodStart(ms: number, g: Granularity): number {
  const d = new Date(ms)
  if (g === 'hour') {
    d.setMinutes(0, 0, 0)
    return d.getTime()
  }
  d.setHours(0, 0, 0, 0)
  if (g === 'week') {
    // Неделя с понедельника.
    const shift = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - shift)
  } else if (g === 'month') {
    d.setDate(1)
  }
  return d.getTime()
}

/** Начало периода, следующего за тем, что начинается в `start`. */
export function nextPeriod(start: number, g: Granularity): number {
  const d = new Date(start)
  if (g === 'hour') d.setHours(d.getHours() + 1)
  else if (g === 'day') d.setDate(d.getDate() + 1)
  else if (g === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

/**
 * Точки в периоды графика. Часы и сутки ноды остаются как есть; часы в сутки,
 * сутки в недели и месяцы — по календарю, по середине корзины.
 */
export function groupPoints(
  points: StatsPoint[],
  g: Granularity,
  source: BucketKind
): StatsPoint[] {
  if (g === source) return points
  const groups = new Map<number, StatsPoint>()
  for (const p of points) {
    const start = periodStart(p.t + (p.end - p.t) / 2, g)
    let group = groups.get(start)
    if (!group) {
      group = { t: start, end: nextPeriod(start, g), counts: {}, parts: 0 }
      groups.set(start, group)
    }
    group.parts += 1
    for (const [type, n] of Object.entries(p.counts)) {
      group.counts[type] = (group.counts[type] ?? 0) + n
    }
  }
  return [...groups.values()].sort((a, b) => a.t - b.t)
}

/** Сколько транзакций этих типов в корзине. */
export function sumTypes(counts: Counts, types: readonly number[]): number {
  let sum = 0
  for (const type of types) sum += counts[String(type)] ?? 0
  return sum
}

export function totalOf(counts: Counts): number {
  let sum = 0
  for (const n of Object.values(counts)) sum += n
  return sum
}

export interface SeriesSpec {
  key: string
  labelKey: string
  /** Цвет — слот категориальной палитры графиков (`--ui-series-N`). */
  color: string
  value: (counts: Counts) => number | null
}

const series = (n: number) => `var(--ui-series-${n})`

export const PUBLICATION_TYPES = [200, 201, 202, 209, 210, 220] as const
const COMMENT_TYPES = [204, 205] as const
const RATING_TYPES = [300, 301] as const
const SUBSCRIPTION_TYPES = [302, 303] as const
const PROFILE_TYPES = [100, 103, 170] as const
const TRANSFER_TYPES = [1] as const
const KNOWN_TYPES = new Set<string>(
  [
    ...PUBLICATION_TYPES,
    ...COMMENT_TYPES,
    ...RATING_TYPES,
    ...SUBSCRIPTION_TYPES,
    ...PROFILE_TYPES,
    ...TRANSFER_TYPES,
  ].map(String)
)

/** Активность сети по видам действий — слои одного стека. */
export const ACTIVITY_SERIES: readonly SeriesSpec[] = [
  {
    key: 'publications',
    labelKey: 'explorerStats.series.publications',
    color: series(1),
    value: (c) => sumTypes(c, PUBLICATION_TYPES),
  },
  {
    key: 'comments',
    labelKey: 'explorerStats.series.comments',
    color: series(2),
    value: (c) => sumTypes(c, COMMENT_TYPES),
  },
  {
    key: 'ratings',
    labelKey: 'explorerStats.series.ratings',
    color: series(3),
    value: (c) => sumTypes(c, RATING_TYPES),
  },
  {
    key: 'subscriptions',
    labelKey: 'explorerStats.series.subscriptions',
    color: series(4),
    value: (c) => sumTypes(c, SUBSCRIPTION_TYPES),
  },
  {
    key: 'profiles',
    labelKey: 'explorerStats.series.profiles',
    color: series(5),
    value: (c) => sumTypes(c, PROFILE_TYPES),
  },
  {
    key: 'transfers',
    labelKey: 'explorerStats.series.transfers',
    color: series(6),
    value: (c) => sumTypes(c, TRANSFER_TYPES),
  },
  {
    key: 'other',
    labelKey: 'explorerStats.series.other',
    color: series(7),
    value: (c) => {
      let sum = 0
      for (const [type, n] of Object.entries(c)) if (!KNOWN_TYPES.has(type)) sum += n
      return sum
    },
  },
]

/** Публикации по видам. */
export const PUBLICATION_SERIES: readonly SeriesSpec[] = [
  {
    key: 'posts',
    labelKey: 'explorerStats.series.posts',
    color: series(1),
    value: (c) => sumTypes(c, [200]),
  },
  {
    key: 'videos',
    labelKey: 'explorerStats.series.videos',
    color: series(2),
    value: (c) => sumTypes(c, [201]),
  },
  {
    key: 'articles',
    labelKey: 'explorerStats.series.articles',
    color: series(3),
    value: (c) => sumTypes(c, [202]),
  },
  {
    key: 'audio',
    labelKey: 'explorerStats.series.audio',
    color: series(4),
    value: (c) => sumTypes(c, [210]),
  },
  {
    key: 'streams',
    labelKey: 'explorerStats.series.streams',
    color: series(5),
    value: (c) => sumTypes(c, [209]),
  },
  {
    key: 'collections',
    labelKey: 'explorerStats.series.collections',
    color: series(6),
    value: (c) => sumTypes(c, [220]),
  },
]

function perPublication(c: Counts, types: readonly number[]): number | null {
  const publications = sumTypes(c, PUBLICATION_TYPES)
  return publications > 0 ? sumTypes(c, types) / publications : null
}

/** Вовлечённость: сколько комментариев и оценок приходится на публикацию. */
export const ENGAGEMENT_SERIES: readonly SeriesSpec[] = [
  {
    key: 'commentsPerPublication',
    labelKey: 'explorerStats.series.commentsPerPublication',
    color: series(1),
    value: (c) => perPublication(c, [204]),
  },
  {
    key: 'ratingsPerPublication',
    labelKey: 'explorerStats.series.ratingsPerPublication',
    color: series(2),
    value: (c) => perPublication(c, [300]),
  },
  {
    key: 'subscriptionsPerPublication',
    labelKey: 'explorerStats.series.subscriptionsPerPublication',
    color: series(3),
    value: (c) => perPublication(c, SUBSCRIPTION_TYPES),
  },
]

export const TRANSFER_SERIES: readonly SeriesSpec[] = [
  {
    key: 'transfers',
    labelKey: 'explorerStats.series.transfers',
    color: series(6),
    value: (c) => sumTypes(c, TRANSFER_TYPES),
  },
]

/**
 * Точки → значения серий. Недели и месяцы — в среднем за сутки: неделя по
 * краям периода и текущий месяц неполные, и сумма за них проседала бы.
 * Отношения (`ratio`) не делятся — они и так «на публикацию».
 */
export function toChartPoints(
  points: StatsPoint[],
  specs: readonly SeriesSpec[],
  g: Granularity,
  source: BucketKind,
  ratio = false
): ChartPoint[] {
  return points.map((p) => {
    const perDay = !ratio && (g === 'week' || g === 'month')
    // Сутки ноды — 1440 блоков; из часов собираем по 24.
    const days = source === 'day' ? p.parts : p.parts / 24
    const values: Record<string, number | null> = {}
    for (const spec of specs) {
      const v = spec.value(p.counts)
      values[spec.key] = v === null ? null : perDay && days > 0 ? v / days : v
    }
    return { t: p.t, end: p.end, values }
  })
}

/** Сколько суток покрывают точки — для «в среднем за день». */
export function coveredDays(points: StatsPoint[], source: BucketKind): number {
  const parts = points.reduce((s, p) => s + p.parts, 0)
  return source === 'day' ? parts : parts / 24
}
