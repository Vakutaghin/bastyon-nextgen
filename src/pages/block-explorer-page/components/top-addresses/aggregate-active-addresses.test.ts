import { describe, it, expect } from 'vitest'
import { aggregateActiveAddresses } from './aggregate-active-addresses'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

function tx(spec: Partial<Transaction>): Transaction {
  return {
    txid: 't', type: 200, height: 1, blockHash: 'b', nTime: 0,
    vin: [], vout: [],
    ...spec,
  }
}

describe('aggregateActiveAddresses', () => {
  it('counts appearances and sums volumes', () => {
    const txs = [
      tx({
        vin: [{ txid: 'p', vout: 1, address: 'PA', value: 5 }],
        vout: [
          { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '' } },
          { n: 1, value: 7, scriptPubKey: { addresses: ['PA'], hex: '' } },
        ],
      }),
    ]
    const out = aggregateActiveAddresses(txs)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      address: 'PA',
      appearances: 1,
      txCount: 1,
      volumeIn: 5,
      volumeOut: 7,
    })
  })

  it('counts each address once per tx for appearances', () => {
    // PA в vin и в vout одной tx — appearances = 1, но обе суммы считаются.
    const txs = [
      tx({
        vin: [{ txid: 'p', vout: 1, address: 'PA', value: 5 }],
        vout: [{ n: 1, value: 7, scriptPubKey: { addresses: ['PA'], hex: '' } }],
      }),
      tx({
        vin: [{ txid: 'p2', vout: 1, address: 'PA', value: 1 }],
        vout: [{ n: 1, value: 2, scriptPubKey: { addresses: ['PB'], hex: '' } }],
      }),
    ]
    const out = aggregateActiveAddresses(txs)
    const a = out.find((r) => r.address === 'PA')!
    const b = out.find((r) => r.address === 'PB')!
    expect(a.appearances).toBe(2)
    expect(a.volumeIn).toBe(6)
    expect(a.volumeOut).toBe(7)
    expect(b.appearances).toBe(1)
    expect(b.volumeOut).toBe(2)
  })

  it('skips empty addresses (OP_RETURN outputs)', () => {
    const txs = [
      tx({
        vin: [],
        vout: [
          { n: 0, value: 0, scriptPubKey: { addresses: [''], hex: '6a05...' } },
          { n: 1, value: 1, scriptPubKey: { addresses: ['PA'], hex: '' } },
        ],
      }),
    ]
    const out = aggregateActiveAddresses(txs)
    expect(out).toHaveLength(1)
    expect(out[0]?.address).toBe('PA')
  })

  it('sorts by appearances desc then by volume desc', () => {
    const txs = [
      // PA — 2 раза, маленькие объёмы
      tx({ vin: [{ txid: 'p', vout: 1, address: 'PA', value: 0.01 }], vout: [] }),
      tx({ vin: [{ txid: 'p', vout: 1, address: 'PA', value: 0.01 }], vout: [] }),
      // PB — 1 раз, большой объём
      tx({ vin: [{ txid: 'p', vout: 1, address: 'PB', value: 1000 }], vout: [] }),
      // PC — 1 раз, маленький объём
      tx({ vin: [{ txid: 'p', vout: 1, address: 'PC', value: 0.001 }], vout: [] }),
    ]
    const out = aggregateActiveAddresses(txs)
    expect(out.map((r) => r.address)).toEqual(['PA', 'PB', 'PC'])
  })

  it('returns empty for empty/missing input', () => {
    expect(aggregateActiveAddresses([])).toEqual([])
  })
})
