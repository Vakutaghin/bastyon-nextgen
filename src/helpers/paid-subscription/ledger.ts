/**
 * Сводки по платежам за подписку: подписчики автора (кто, сколько, до какого
 * числа) и авторы, на которых подписан я.
 */

import { MONTH_SECONDS, PAYMENTS_WINDOW_MONTHS } from './plans'
import {
  paidSubscriptionStatus,
  type PaidSubscriptionStatus,
  type SubscriptionPayment,
} from './status'

/** Одна сторона платежей: подписчик (у автора) или автор (у подписчика). */
export interface PaidCounterparty {
  address: string
  status: PaidSubscriptionStatus
  /** Всё, что пришло (ушло) за последний год, сатоши. */
  total: number
  /** Последний платёж. */
  last: SubscriptionPayment
  /** Платежи за год, новые первыми. */
  payments: SubscriptionPayment[]
}

/** Платежи по контрагенту: `from` — подписчики, `to` — авторы. */
export function groupPayments(
  payments: readonly SubscriptionPayment[],
  side: 'from' | 'to'
): Map<string, SubscriptionPayment[]> {
  const groups = new Map<string, SubscriptionPayment[]>()
  for (const payment of payments) {
    const key = payment[side]
    const list = groups.get(key)
    if (list) list.push(payment)
    else groups.set(key, [payment])
  }
  for (const list of groups.values()) list.sort((a, b) => b.time - a.time)
  return groups
}

/** Сколько пришло с `since` (unix-секунды), сатоши. */
export function sumSince(payments: readonly SubscriptionPayment[], since: number): number {
  return payments.reduce((sum, p) => (p.time > since ? sum + p.amount : sum), 0)
}

/** Начало «последнего года» в смысле сроков подписки. */
export function yearAgo(now: number): number {
  return now - PAYMENTS_WINDOW_MONTHS * MONTH_SECONDS
}

/**
 * Сводка по контрагентам: сначала действующие (дольше всех — выше), потом
 * закончившиеся (недавние — выше). `priceOf` — цена автора: у автора она одна
 * на всех подписчиков, у подписчика своя у каждого автора.
 */
export function summarize(
  payments: readonly SubscriptionPayment[],
  side: 'from' | 'to',
  priceOf: (address: string) => number,
  now: number
): PaidCounterparty[] {
  const since = yearAgo(now)
  const rows: PaidCounterparty[] = []
  for (const [address, list] of groupPayments(payments, side)) {
    const recent = list.filter((p) => p.time > since)
    if (!recent.length) continue
    rows.push({
      address,
      status: paidSubscriptionStatus(recent, priceOf(address), now),
      total: sumSince(recent, since),
      last: recent[0]!,
      payments: recent,
    })
  }
  return rows.sort((a, b) => rank(b) - rank(a))
}

/** Порядок: действующие по концу срока, потом закончившиеся по дате платежа. */
function rank(row: PaidCounterparty): number {
  if (row.status.kind === 'active') return 2e10 + row.status.until
  return row.last.time
}
