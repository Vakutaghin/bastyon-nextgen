/**
 * Платная подписка на автора — условия сети, общие для всех клиентов.
 *
 * Отдельной записи «подписка оформлена» в блокчейне нет. Автор назначает цену
 * за месяц в настройках аккаунта (`accSet.paidsubscription`), подписчик платит
 * обычным переводом с меткой `a:subscription`, а клиент сам решает, хватает ли
 * платежей за последний месяц, полгода или год. Сроки и множители — как у
 * старого клиента (satolist.js, `paidsubscription.checkvisibilityStrong`):
 * иначе подписка, оплаченная там, здесь считалась бы иначе.
 */

export type PaidPlanId = '1m' | '6m' | '1y'

export interface PaidPlan {
  id: PaidPlanId
  /** Срок в месяцах. */
  months: number
  /** Цена срока в месячных ценах: полгода дешевле на 8 %, год — на 17 %. */
  factor: number
}

export const PAID_PLANS: readonly PaidPlan[] = [
  { id: '1m', months: 1, factor: 1 },
  { id: '6m', months: 6, factor: 5.5 },
  { id: '1y', months: 12, factor: 10 },
]

/** Месяц старого клиента — 30,5 суток. */
export const MONTH_SECONDS = 2_635_200

/** Блоков в месяце (блок — раз в минуту): глубина запроса платежей. */
export const BLOCKS_PER_MONTH = 43_200

/** Платежи старше этого срока подписку уже не продлевают. */
export const PAYMENTS_WINDOW_MONTHS = 12

/** Цена за месяц, PKOIN: целое число, как в настройке старого клиента. */
export const MIN_PRICE = 1
export const MAX_PRICE = 1500

/** Сатоши в одном PKOIN. */
export const SATOSHI = 100_000_000

export function planById(id: PaidPlanId): PaidPlan {
  return PAID_PLANS.find((plan) => plan.id === id)!
}

/** Цена срока в сатоши. */
export function planCost(price: number, plan: PaidPlan): number {
  return Math.round(price * SATOSHI * plan.factor)
}

/** Допустимая цена: целое от 1 до 1500 PKOIN. */
export function isValidPrice(price: number): boolean {
  return Number.isInteger(price) && price >= MIN_PRICE && price <= MAX_PRICE
}
