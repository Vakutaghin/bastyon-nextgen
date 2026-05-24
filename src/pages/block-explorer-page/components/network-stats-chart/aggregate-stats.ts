/**
 * Превращает «сырой» ответ getstatisticby{hours,days} в массив точек для чарта.
 *
 * Каждая точка: { bucket, total, content, ratings, subscriptions, accounts }.
 * Категории по нашему [tx-type-labels]:
 *   - content       — пост/видео/статья/коммент/правка/коллекция (200, 201, 202, 203, 204, 205, 206, 207, 208, 209)
 *   - ratings       — оценки (300, 301)
 *   - subscriptions — подписки и отписки (302, 303, 304)
 *   - accounts      — действия с профилем/аккаунтом (100, 101, 102, 103, 104, 211)
 *   - moderation    — модерация (305, 306, 308, 400, 401)
 *   - other         — coinbase/coinstake/transfers и т.п. (всё остальное)
 *
 * Точки идут по возрастанию ключа bucket (parseInt(key)).
 * Если ответ пустой/невалидный — возвращаем пустой массив.
 */

import type { StatisticBuckets } from '@/types/rpc-responses/get-statistic'

export interface StatsPoint {
  /** Числовой идентификатор bucket-а (час/день от точки отсчёта ноды). */
  bucket: number
  total: number
  content: number
  ratings: number
  subscriptions: number
  accounts: number
  moderation: number
  other: number
}

const CONTENT_TYPES = new Set([200, 201, 202, 203, 204, 205, 206, 207, 208, 209])
const RATING_TYPES = new Set([300, 301])
const SUBSCRIPTION_TYPES = new Set([302, 303, 304])
const ACCOUNT_TYPES = new Set([100, 101, 102, 103, 104, 211])
const MODERATION_TYPES = new Set([305, 306, 308, 400, 401])

export function aggregateStats(buckets: StatisticBuckets | null | undefined): StatsPoint[] {
  if (!buckets || typeof buckets !== 'object') return []
  const keys = Object.keys(buckets)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
  return keys.map((bucket): StatsPoint => {
    const breakdown = buckets[String(bucket)] ?? {}
    let total = 0
    let content = 0
    let ratings = 0
    let subscriptions = 0
    let accounts = 0
    let moderation = 0
    let other = 0
    for (const [typeStr, count] of Object.entries(breakdown)) {
      const n = Number(count)
      if (!Number.isFinite(n) || n <= 0) continue
      total += n
      const type = Number(typeStr)
      if (CONTENT_TYPES.has(type))           content += n
      else if (RATING_TYPES.has(type))        ratings += n
      else if (SUBSCRIPTION_TYPES.has(type))  subscriptions += n
      else if (ACCOUNT_TYPES.has(type))       accounts += n
      else if (MODERATION_TYPES.has(type))    moderation += n
      else                                    other += n
    }
    return { bucket, total, content, ratings, subscriptions, accounts, moderation, other }
  })
}

/** Сколько активности всего по точкам — для подписи под графиком. */
export function sumTotals(points: StatsPoint[]): number {
  return points.reduce((s, p) => s + p.total, 0)
}

/** Максимальный total в наборе — для оси Y. */
export function maxTotal(points: StatsPoint[]): number {
  return points.reduce((m, p) => (p.total > m ? p.total : m), 0)
}
