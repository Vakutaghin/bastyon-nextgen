// Сводка для автора: кто подписан, на какой срок, сколько заплатил.

import { describe, expect, it } from 'vitest'

import { summarize, sumSince } from './ledger'
import { MONTH_SECONDS, SATOSHI } from './plans'
import type { SubscriptionPayment } from './status'

const NOW = 1_792_000_000
const DAY = 86_400

function pay(from: string, pkoin: number, daysAgo: number): SubscriptionPayment {
  return {
    from,
    to: 'PAuthor',
    txid: `${from}-${daysAgo}`,
    height: 1,
    amount: pkoin * SATOSHI,
    time: NOW - daysAgo * DAY,
  }
}

describe('summarize', () => {
  const payments = [
    pay('PMonth', 10, 5),
    pay('PYear', 100, 30),
    pay('PEnded', 10, 50),
    pay('PEnded', 10, 400), // старше года — не в счёт
  ]

  it('действующие сверху, дольше всех — первым; закончившиеся ниже', () => {
    const rows = summarize(payments, 'from', () => 10, NOW)
    expect(rows.map((r) => [r.address, r.status.kind])).toEqual([
      ['PYear', 'active'],
      ['PMonth', 'active'],
      ['PEnded', 'inactive'],
    ])
    expect(rows[0]!.status).toMatchObject({
      plan: '1y',
      until: NOW - 30 * DAY + 12 * MONTH_SECONDS,
    })
    expect(rows[2]).toMatchObject({ total: 10 * SATOSHI, last: { time: NOW - 50 * DAY } })
  })

  it('у подписчика своя цена у каждого автора', () => {
    const mine = [
      { ...pay('PMe', 10, 5), to: 'PCheap' },
      { ...pay('PMe', 10, 6), to: 'PDear' },
    ]
    const rows = summarize(mine, 'to', (a) => (a === 'PCheap' ? 10 : 50), NOW)
    expect(Object.fromEntries(rows.map((r) => [r.address, r.status.kind]))).toEqual({
      PCheap: 'active',
      PDear: 'inactive',
    })
  })

  it('доход за период', () => {
    expect(sumSince(payments, NOW - 31 * DAY)).toBe(110 * SATOSHI)
  })
})
