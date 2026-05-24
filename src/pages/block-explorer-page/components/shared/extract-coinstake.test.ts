import { describe, it, expect } from 'vitest'
import { extractCoinstakeInfo, calcConfirmations } from './extract-coinstake'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

function makeCoinstake(staker: string, vinValue: number, voutValue: number): Transaction {
  return {
    txid: 'cs',
    type: 3,
    height: 100,
    blockHash: 'b',
    nTime: 0,
    vin: [{ txid: 'parent', vout: 1, address: staker, value: vinValue }],
    vout: [
      { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '' } },
      { n: 1, value: voutValue, scriptPubKey: { addresses: [staker], hex: '76a9...' } },
    ],
  }
}

describe('extractCoinstakeInfo', () => {
  it('returns staker and reward from PoS coinstake tx', () => {
    const txs = [makeCoinstake('PFZ29uk61s1Y31xoaYUfQW1h4zFTF7rvAP', 5.57, 8.07000084)]
    const info = extractCoinstakeInfo(txs)
    expect(info).not.toBeNull()
    expect(info!.staker).toBe('PFZ29uk61s1Y31xoaYUfQW1h4zFTF7rvAP')
    expect(info!.reward).toBeCloseTo(2.50000084, 8)
    expect(info!.kind).toBe('pos')
  })

  it('clamps negative reward to 0', () => {
    const txs = [makeCoinstake('Pabc', 10, 5)]
    const info = extractCoinstakeInfo(txs)
    expect(info!.reward).toBe(0)
  })

  it('finds coinstake even if not first', () => {
    const post: Transaction = {
      txid: 'p', type: 200, height: 100, blockHash: 'b', nTime: 0,
      vin: [], vout: [],
    }
    const cs = makeCoinstake('Pstaker', 1, 2)
    const info = extractCoinstakeInfo([post, cs])
    expect(info!.staker).toBe('Pstaker')
  })

  it('falls back to PoW coinbase when no coinstake', () => {
    const coinbase: Transaction = {
      txid: 'cb', type: 1, height: 100, blockHash: 'b', nTime: 0,
      vin: [{ txid: '', vout: -1, coinbase: 'abcd' }],
      vout: [
        { n: 0, value: 50, scriptPubKey: { addresses: ['Pminer'], hex: '' } },
      ],
    }
    const info = extractCoinstakeInfo([coinbase])
    expect(info!.staker).toBe('Pminer')
    expect(info!.reward).toBe(50)
    expect(info!.kind).toBe('pow')
  })

  it('returns null when no coinbase/coinstake present', () => {
    const post: Transaction = {
      txid: 'p', type: 200, height: 100, blockHash: 'b', nTime: 0,
      vin: [], vout: [],
    }
    expect(extractCoinstakeInfo([post])).toBeNull()
    expect(extractCoinstakeInfo([])).toBeNull()
  })

  it('returns null when coinstake has no staker address', () => {
    const broken: Transaction = {
      txid: 'cs', type: 3, height: 100, blockHash: 'b', nTime: 0,
      vin: [{ txid: 'p', vout: 1, value: 1 }],
      vout: [
        { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '' } },
        { n: 1, value: 2, scriptPubKey: { addresses: [''], hex: '' } },
      ],
    }
    expect(extractCoinstakeInfo([broken])).toBeNull()
  })
})

describe('calcConfirmations', () => {
  it('returns 1 for tip', () => {
    expect(calcConfirmations(100, 100)).toBe(1)
  })

  it('returns N+1 for block N below tip', () => {
    expect(calcConfirmations(90, 100)).toBe(11)
  })

  it('returns 0 for block above tip (invalid state)', () => {
    expect(calcConfirmations(101, 100)).toBe(0)
  })

  it('returns 0 when inputs are not finite', () => {
    expect(calcConfirmations(NaN, 100)).toBe(0)
    expect(calcConfirmations(100, Number.POSITIVE_INFINITY)).toBe(0)
  })
})
