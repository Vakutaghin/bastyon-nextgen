import { describe, it, expect } from 'vitest'
import { classifyWalletTx } from './classify-tx'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

const ME = 'PMyAddr1111111111111111111111111111'
const OTHER = 'POther222222222222222222222222222222'
const mine = new Set([ME])

/** Минимальная tx-болванка с заданными vin/vout (опц. on-chain type). */
function tx(
  vin: { address?: string; value?: number }[],
  vout: { value: number; address: string }[],
  type = 1
): Transaction {
  return {
    txid: 'tx',
    type,
    height: 1,
    blockHash: 'b',
    nTime: 0,
    vin: vin.map((i) => ({ txid: '', vout: 0, address: i.address, value: i.value })),
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
  // Формы транзакций — как у настоящих на mainnet (22.10.2026).
  const OP_RETURN = { value: 0, address: '' }

  it('буст (208): трата на сумму комиссии, выходов на чужие адреса нет', () => {
    const r = classifyWalletTx(
      tx([{ address: ME, value: 7 }], [OP_RETURN, { value: 4.5, address: ME }], 208),
      mine
    )
    expect(r).toMatchObject({
      direction: 'out',
      amount: 2.5,
      semantic: 'boost',
      counterparties: [],
    })
  })

  it('307 — жалоба, а не буст: без движения монет', () => {
    const r = classifyWalletTx(
      tx([{ address: ME, value: 1 }], [OP_RETURN, { value: 1, address: ME }], 307),
      mine
    )
    expect(r.direction).toBe('change')
  })

  it('свой комментарий без монет: OP_RETURN — не получатель', () => {
    const r = classifyWalletTx(
      tx([{ address: ME, value: 1 }], [OP_RETURN, { value: 1, address: ME }], 204),
      mine
    )
    expect(r).toMatchObject({ direction: 'change', amount: 0 })
  })

  it('комментарий с монетами автору поста — получено', () => {
    const r = classifyWalletTx(
      tx(
        [{ address: OTHER, value: 1.1 }],
        [OP_RETURN, { value: 1, address: ME }, { value: 0.1, address: OTHER }],
        204
      ),
      mine
    )
    expect(r).toMatchObject({
      direction: 'in',
      amount: 1,
      semantic: 'comment',
      counterparties: [OTHER],
    })
  })

  it('выигрыш лотереи — выход мне в чужом coinstake', () => {
    const r = classifyWalletTx(
      tx(
        [{ address: OTHER, value: 60.9 }],
        [
          OP_RETURN,
          { value: 31.66, address: OTHER },
          { value: 31.6775, address: OTHER },
          { value: 0.03125, address: ME },
        ],
        3
      ),
      mine
    )
    expect(r).toMatchObject({ direction: 'in', amount: 0.03125, semantic: 'lottery' })
  })

  it('свой coinstake: награда = выходы мне − мои входы, выходы лотереи другим не трата', () => {
    const r = classifyWalletTx(
      tx(
        [{ address: ME, value: 100 }],
        [
          OP_RETURN,
          { value: 50, address: ME },
          { value: 52.5, address: ME },
          { value: 0.0125, address: OTHER },
        ],
        3
      ),
      mine
    )
    expect(r).toMatchObject({ direction: 'in', amount: 2.5, semantic: 'stake' })
  })

  it('выплата монетизации — метка a:monetization', () => {
    const t = tx([{ address: OTHER }], [{ value: 0.53, address: ME }])
    t.vout.unshift({
      n: 0,
      value: 0,
      scriptPubKey: { addresses: [''], hex: '6a0e613a6d6f6e6574697a6174696f6e' },
    })
    expect(classifyWalletTx(t, mine)).toMatchObject({
      direction: 'in',
      amount: 0.53,
      semantic: 'monetization',
    })
  })

  it('обычный перевод — semantic null', () => {
    const r = classifyWalletTx(tx([{ address: ME }], [{ value: 1, address: OTHER }]), mine)
    expect(r.semantic).toBeNull()
  })

  it('чаевые — метка a:donate в OP_RETURN', () => {
    const t = tx([{ address: OTHER }], [{ value: 5, address: ME }], 1)
    const donate = Buffer.from('a:donate', 'utf8').toString('hex')
    t.vout.unshift({ n: 0, value: 0, scriptPubKey: { addresses: [], hex: `6a08${donate}` } })
    const r = classifyWalletTx(t, mine)
    expect(r).toMatchObject({ direction: 'in', amount: 5, semantic: 'donate' })
  })

  it('оплата платной подписки — метка a:subscription', () => {
    const t = tx([{ address: ME }], [{ value: 55, address: OTHER }], 1)
    t.vout.unshift({
      n: 0,
      value: 0,
      scriptPubKey: { addresses: [], hex: '6a0e613a737562736372697074696f6e' },
    })
    expect(classifyWalletTx(t, mine)).toMatchObject({
      direction: 'out',
      amount: 55,
      semantic: 'subscription',
    })
  })
})
