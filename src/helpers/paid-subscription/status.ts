/**
 * Оплачена ли подписка на автора и что предложить, если нет.
 *
 * Правило старого клиента: подписка действует, пока платежи автору за
 * последний месяц покрывают цену месяца, или за полгода — цену полугода
 * (×5,5), или за год — цену года (×10). Старый клиент проверял это окнами
 * «сейчас» и искал конец срока перебором по дням; здесь конец срока
 * считается точно: срок держится, пока в окне остаётся самый старый из
 * платежей, без которого сумма уже не дотягивает.
 */

import { DUST_VALUE, AMOUNT_MULTIPLIER } from '@/blockchain/constants/transactions'
import { MONTH_SECONDS, PAID_PLANS, planCost, type PaidPlan, type PaidPlanId } from './plans'

/** Платёж за подписку: перевод с меткой `a:subscription`. */
export interface SubscriptionPayment {
  from: string
  to: string
  txid: string
  /** Высота блока; 0 — ещё не в блоке (только что отправлен отсюда). */
  height: number
  /** Сумма, сатоши. */
  amount: number
  /** Время транзакции, unix-секунды. */
  time: number
}

/** Что можно оплатить сейчас. */
export interface PaidOffer {
  plan: PaidPlanId
  /** Сколько заплатить, сатоши. */
  amount: number
  /** Полная цена срока, сатоши. */
  cost: number
  /** Доплата: часть срока уже покрыта прежними платежами. */
  topUp: boolean
  /** До какого времени будет оплачено после платежа, unix-секунды. */
  until: number
}

export type PaidSubscriptionStatus =
  /** Оплачено: посты для платных подписчиков открыты (если подписан на автора). */
  | { kind: 'active'; until: number; plan: PaidPlanId; offers: PaidOffer[] }
  /** Не оплачено (или срок кончился `endedAt`). */
  | { kind: 'inactive'; offers: PaidOffer[]; endedAt: number | null }
  /** Автор отключил платную подписку: такие посты открыты его подписчикам. */
  | { kind: 'open' }
  /** Автор цену не назначал: оформить подписку нельзя. */
  | { kind: 'unavailable' }

/** Выход меньше пыли нода не примет — доплату округляем до неё. */
const MIN_PAYMENT = Math.round(DUST_VALUE * AMOUNT_MULTIPLIER)

/** До какого времени срок оплачен этими платежами; null — не оплачен. */
export function planPaidUntil(
  payments: readonly SubscriptionPayment[],
  price: number,
  plan: PaidPlan
): number | null {
  const cost = planCost(price, plan)
  const newestFirst = [...payments].sort((a, b) => b.time - a.time)
  let sum = 0
  for (const payment of newestFirst) {
    sum += payment.amount
    if (sum >= cost) return payment.time + plan.months * MONTH_SECONDS
  }
  return null
}

/** Самый поздний конец срока по всем срокам: какой срок его даёт и когда. */
function bestUntil(
  payments: readonly SubscriptionPayment[],
  price: number
): { plan: PaidPlanId; until: number } | null {
  let best: { plan: PaidPlanId; until: number } | null = null
  for (const plan of PAID_PLANS) {
    const until = planPaidUntil(payments, price, plan)
    if (until !== null && (!best || until > best.until)) best = { plan: plan.id, until }
  }
  return best
}

/** Сумма платежей, ещё лежащих в окне срока на момент `now`. */
function windowSum(payments: readonly SubscriptionPayment[], plan: PaidPlan, now: number): number {
  const start = now - plan.months * MONTH_SECONDS
  return payments.reduce((sum, p) => (p.time > start ? sum + p.amount : sum), 0)
}

/**
 * Статус подписки на автора с ценой `price` (PKOIN в месяц) по платежам
 * подписчика этому автору.
 */
export function paidSubscriptionStatus(
  payments: readonly SubscriptionPayment[],
  price: number,
  now: number
): PaidSubscriptionStatus {
  if (!Number.isFinite(price) || price === 0) return { kind: 'unavailable' }
  if (price < 0) return { kind: 'open' }

  const best = bestUntil(payments, price)
  const activeUntil = best && best.until > now ? best.until : null

  const offers: PaidOffer[] = []
  for (const plan of PAID_PLANS) {
    const cost = planCost(price, plan)
    const covered = windowSum(payments, plan, now)
    if (covered >= cost) continue
    const amount = Math.max(cost - covered, MIN_PAYMENT)
    const until = planPaidUntil([...payments, paymentStub(amount, now)], price, plan)
    // Доплата, которая не продлевает уже оплаченный срок, не нужна.
    if (until === null || (activeUntil !== null && until <= activeUntil)) continue
    offers.push({ plan: plan.id, amount, cost, topUp: covered > 0, until })
  }

  if (best && activeUntil !== null) {
    return { kind: 'active', until: activeUntil, plan: best.plan, offers }
  }
  return { kind: 'inactive', offers, endedAt: best?.until ?? null }
}

function paymentStub(amount: number, time: number): SubscriptionPayment {
  return { from: '', to: '', txid: '', height: 0, amount, time }
}
