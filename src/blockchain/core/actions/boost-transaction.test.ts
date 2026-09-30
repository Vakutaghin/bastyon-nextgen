// Буст, собранный НАСТОЯЩЕЙ btc17 (без моков), совпадает по формату с бустом из
// mainnet: транзакция 540ba509…, блок 4035441, буст поста 6bce6520… на 2,5 PKOIN.
// У неё vout[0] — OP_RETURN ['contentBoost', hash256(txid поста)], vout[1] —
// сдача продвигающему; входы − выходы = буст + 1 сатоши комиссии.

import { describe, expect, it, vi } from 'vitest'
import { Buffer } from 'buffer'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { POCKETNET_NETWORK } from '@/blockchain/constants/network'
import { buildTransaction } from '../transactions/transaction-builder'
import type { KeyPair } from '../../types/keys'
// @ts-expect-error legacy js module without types
import { Transaction } from '../../lib/pocketnet/modules/transaction.js'
// @ts-expect-error legacy js module without types
import * as payments from '../../lib/pocketnet/modules/payments/index.js'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

// btc17 и typeforce в приложении живут с одним Buffer — npm-полифиллом (см.
// transaction-builder-e2e.test.ts); в Node глобальный Buffer другой класс.
;(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer

const ECPair = ECPairFactory(ecc)

/** Пост из mainnet и OP_RETURN настоящего буста этого поста (getaddresstransactions). */
const POST = '6bce6520df694128c10c45b6f20a1028a604ce7e70b170a9362cea183d2d87eb'
const MAINNET_OP_RETURN =
  '6a0c636f6e74656e74426f6f737420b837d1237a4ecc6c498ec6d2758c5362ca5f0e1347ce74317c767fc19a642ed7'

describe('contentBoost на настоящей btc17', () => {
  it('OP_RETURN как у буста из mainnet, буст — разница входов и выходов', async () => {
    const ecPair = ECPair.fromPrivateKey(new Uint8Array(Buffer.from('03'.repeat(32), 'hex')), {
      network: POCKETNET_NETWORK,
    })
    const pubkey = Buffer.from(ecPair.publicKey)
    const p2pkh = payments.p2pkh({ pubkey, network: POCKETNET_NETWORK })
    const keyPair = { ecPair, publicKey: pubkey } as unknown as KeyPair

    const inputSat = 500_000_000
    const built = await buildTransaction({
      unspents: [
        { txid: 'aa'.repeat(32), vout: 0, amount: 5, scriptPubKey: p2pkh.output.toString('hex') },
      ],
      fromAddress: p2pkh.address,
      keyPair,
      serializedData: POST,
      operationType: 'contentBoost',
      fee: 2.5 + 1e-8,
    })

    const tx = Transaction.fromHex(built.hex)
    expect(tx.outs).toHaveLength(2)
    expect(Buffer.from(tx.outs[0].script).toString('hex')).toBe(MAINNET_OP_RETURN)
    expect(tx.outs[0].value).toBe(0)
    expect(Buffer.from(tx.outs[1].script).equals(p2pkh.output)).toBe(true)
    expect(inputSat - tx.outs[1].value).toBe(250_000_001)
  })
})
