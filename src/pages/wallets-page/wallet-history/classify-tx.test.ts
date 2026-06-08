import { describe, it, expect } from 'vitest'
import { classifyWalletTx } from './classify-tx'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

const ME = 'PMyAddr1111111111111111111111111111'
const OTHER = 'POther222222222222222222222222222222'
const mine = new Set([ME])

/** Минимальная tx-болванка с заданными vin/vout (опц. on-chain type). */
function tx(
  vin: { address?: string }[],
  vout: { value: number; address: string }[],
  type = 4
): Transaction {
  return {
    txid: 'tx',
    type,
    height: 1,
    blockHash: 'b',
    nTime: 0,
    vin: vin.map((i) => ({ txid: '', vout: 0, address: i.address })),
    vout: vout.map((o, n) => ({
      n,
      value: o.value,
      scriptPubKey: { addresses: o.address ? [o.address] : [], hex: '' },
    })),
  }
}

describe('classifyWalletTx', () => {
  it('received: external in, output to me → in + amount', () => {
    const r = classifyWalletTx(tx([{ address: OTHER }], [{ value: 5, address: ME }]), mine)
    expect(r.direction).toBe('in')
    expect(r.amount).toBe(5)
    expect(r.counterparties).toEqual([OTHER])
  })

  it('sent: my input, output to other (+ change back) → out + amount to other', () => {
    const r = classifyWalletTx(
      tx(
        [{ address: ME }],
        [
          { value: 3, address: OTHER },
          { value: 7, address: ME },
        ]
      ),
      mine
    )
    expect(r.direction).toBe('out')
    expect(r.amount).toBe(3)
    expect(r.counterparties).toEqual([OTHER])
  })

  it('post/comment: my input, all outputs back to me → change, amount 0', () => {
    const r = classifyWalletTx(tx([{ address: ME }], [{ value: 9, address: ME }]), mine)
    expect(r.direction).toBe('change')
    expect(r.amount).toBe(0)
  })

  it('coinbase reward: no vin address, output to me → in', () => {
    const r = classifyWalletTx(tx([{}], [{ value: 2, address: ME }]), mine)
    expect(r.direction).toBe('in')
    expect(r.amount).toBe(2)
  })
})

describe('classifyWalletTx semantic', () => {
  it('помечает boost (type 307)', () => {
    const r = classifyWalletTx(tx([{ address: ME }], [{ value: 1, address: OTHER }], 307), mine)
    expect(r.semantic).toBe('boost')
  })

  it('помечает stake (coinstake, type 3)', () => {
    const r = classifyWalletTx(tx([{ address: OTHER }], [{ value: 1, address: ME }], 3), mine)
    expect(r.semantic).toBe('stake')
  })

  it('обычный перевод — semantic null', () => {
    const r = classifyWalletTx(tx([{ address: ME }], [{ value: 1, address: OTHER }], 4), mine)
    expect(r.semantic).toBeNull()
  })
})
