// Оплачена ли подписка — по тем же правилам, что у старого клиента: иначе
// подписку, оплаченную там, это приложение считало бы иначе.

import { describe, expect, it } from 'vitest'

import { MONTH_SECONDS, PAID_PLANS, SATOSHI } from './plans'
import { paidSubscriptionStatus, type SubscriptionPayment } from './status'

const NOW = 1_792_000_000
const DAY = 86_400

function pay(pkoin: number, daysAgo: number): SubscriptionPayment {
  return {
    from: 'PSubscriber',
    to: 'PAuthor',
    txid: `tx${pkoin}-${daysAgo}`,
    height: 1,
    amount: Math.round(pkoin * SATOSHI),
    time: NOW - daysAgo * DAY,
  }
}

describe('paidSubscriptionStatus', () => {
  it('цену автор не назначал — оформить нельзя; отключил — посты открыты подписчикам', () => {
    expect(paidSubscriptionStatus([], 0, NOW)).toEqual({ kind: 'unavailable' })
    expect(paidSubscriptionStatus([pay(5, 1)], -1, NOW)).toEqual({ kind: 'open' })
  })

  it('без платежей — три срока по полной цене', () => {
    const status = paidSubscriptionStatus([], 10, NOW)
    expect(status.kind).toBe('inactive')
    if (status.kind !== 'inactive') return
    expect(status.endedAt).toBeNull()
    expect(status.offers.map((o) => [o.plan, o.amount / SATOSHI, o.topUp])).toEqual([
      ['1m', 10, false],
      ['6m', 55, false],
      ['1y', 100, false],
    ])
    expect(status.offers[0]!.until).toBe(NOW + MONTH_SECONDS)
  })

  it('месяц оплачен 10 дней назад — подписка до конца месяца от платежа', () => {
    const status = paidSubscriptionStatus([pay(10, 10)], 10, NOW)
    expect(status).toMatchObject({
      kind: 'active',
      plan: '1m',
      until: NOW - 10 * DAY + MONTH_SECONDS,
    })
    // Месяц уже покрыт; полгода — доплата, и срок от первого платежа.
    if (status.kind !== 'active') return
    expect(status.offers.map((o) => [o.plan, o.amount / SATOSHI, o.topUp])).toEqual([
      ['6m', 45, true],
      ['1y', 90, true],
    ])
    expect(status.offers[0]!.until).toBe(NOW - 10 * DAY + 6 * MONTH_SECONDS)
  })

  it('срок кончился — видно когда, а доплата по старым платежам дешевле', () => {
    const status = paidSubscriptionStatus([pay(10, 40)], 10, NOW)
    expect(status).toMatchObject({ kind: 'inactive', endedAt: NOW - 40 * DAY + MONTH_SECONDS })
    if (status.kind !== 'inactive') return
    expect(status.offers.map((o) => [o.plan, o.amount / SATOSHI, o.topUp])).toEqual([
      ['1m', 10, false],
      ['6m', 45, true],
      ['1y', 90, true],
    ])
  })

  it('несколько платежей складываются, а цена ×5,5 даёт полгода', () => {
    const status = paidSubscriptionStatus([pay(30, 100), pay(25, 20)], 10, NOW)
    expect(status).toMatchObject({
      kind: 'active',
      plan: '6m',
      until: NOW - 100 * DAY + 6 * MONTH_SECONDS,
    })
  })

  it('крошечная доплата не меньше пыли — меньше нода не примет', () => {
    // До цены полугода не хватает 100 сатоши.
    const status = paidSubscriptionStatus([pay(55 - 0.000001, 40)], 10, NOW)
    if (status.kind !== 'inactive') throw new Error(status.kind)
    const sixMonths = status.offers.find((o) => o.plan === '6m')!
    expect(sixMonths).toMatchObject({ amount: 700, topUp: true })
  })
})

/**
 * Проверка старого клиента (satolist.js, checkvisibilityStrong): окна «сейчас»
 * и конец срока перебором по дням. Конец срока там искался с `balance > 0`, и
 * оплата ровно по цене давала «оплачено до сегодня»; здесь сравнение с тем же
 * `>= 0`, что и у самой проверки.
 */
function legacyCheck(payments: SubscriptionPayment[], price: number, now: number) {
  const window = (shift: number) =>
    PAID_PLANS.map((plan) => {
      const start = now - plan.months * MONTH_SECONDS + shift
      const value = price * plan.factor
      return payments.reduce((b, p) => (p.time > start ? b + p.amount / SATOSHI : b), -value)
    })
  const active = window(0).some((balance) => balance >= -1e-9)
  let until = 0
  if (active) {
    for (let i = 0; i < 365; i++) {
      if (!window(i * DAY).some((balance) => balance >= -1e-9)) {
        until = now + i * DAY
        break
      }
    }
  }
  return { active, until }
}

describe('совпадает со старым клиентом', () => {
  it('на случайных платежах', () => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let round = 0; round < 300; round++) {
      const price = 1 + Math.floor(random() * 50)
      const payments = Array.from({ length: Math.floor(random() * 5) }, () =>
        pay(Math.round(random() * price * 8 * 100) / 100, Math.floor(random() * 400))
      )
      const legacy = legacyCheck(payments, price, NOW)
      const status = paidSubscriptionStatus(payments, price, NOW)
      expect(status.kind === 'active', JSON.stringify({ price, payments })).toBe(legacy.active)
      if (status.kind === 'active' && legacy.until) {
        // Старый клиент шагает сутками: точный конец срока — в последних сутках.
        expect(status.until).toBeGreaterThan(legacy.until - DAY)
        expect(status.until).toBeLessThanOrEqual(legacy.until)
      }
    }
  })
})
