import { describe, it, expect } from 'vitest'
import { splitFeeAcrossReceivers } from './split-fee'
import { DEFAULT_TX_FEE, toSatoshis } from '../../constants/transactions'

describe('splitFeeAcrossReceivers (P2-4)', () => {
  it('exclude: суммы получателей не трогаем', () => {
    const out = splitFeeAcrossReceivers([{ address: 'A', amount: 1 }], 'exclude', DEFAULT_TX_FEE)
    expect(out).toEqual([{ address: 'A', amount: 1 }])
  })

  it('include, один получатель: комиссия вычитается из его выхода', () => {
    const [r] = splitFeeAcrossReceivers([{ address: 'A', amount: 1 }], 'include', DEFAULT_TX_FEE)
    expect(toSatoshis(r!.amount)).toBe(toSatoshis(1) - toSatoshis(DEFAULT_TX_FEE))
  })

  it('include, несколько получателей: комиссия делится поровну, остаток — первому (как legacy)', () => {
    const fee = 0.00000005 // 5 сатоши на троих: 2+1+1... → доли 1,1,1 и остаток 2 → +1,+1
    const out = splitFeeAcrossReceivers(
      [
        { address: 'A', amount: 1 },
        { address: 'B', amount: 2 },
        { address: 'C', amount: 3 },
      ],
      'include',
      fee
    )
    const sats = out.map((r) => toSatoshis(r.amount))
    expect(sats).toEqual([toSatoshis(1) - 2, toSatoshis(2) - 2, toSatoshis(3) - 1])
    // Итого выходы = запрошенное − комиссия ⇒ сдача = входы − запрошенное (без недофинансирования).
    const totalOut = sats.reduce((s, v) => s + v, 0)
    expect(totalOut).toBe(toSatoshis(6) - toSatoshis(fee))
  })

  it('include: сумма меньше своей доли комиссии → ошибка, а не отрицательный выход', () => {
    expect(() =>
      splitFeeAcrossReceivers([{ address: 'A', amount: 0.00000001 }], 'include', 0.00000002)
    ).toThrow(/does not cover/)
  })
})
