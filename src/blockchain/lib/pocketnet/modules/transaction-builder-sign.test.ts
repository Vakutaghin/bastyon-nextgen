// Регрессия: контентные транзакции (посты/комменты/оценки) подписываются
// объектной формой txb.sign({ prevOutScriptType, vin, keyPair }), которая
// прогоняет keyPair через typeforce-тип Signer в checkSignArgs. ecpair v3
// отдаёт publicKey как Uint8Array (не Node Buffer) и не имеет getPublicKey(),
// из-за чего старый Signer бросал «sign must include keyPair parameter as
// Signer interface» и публикация поста падала. Тест фиксирует, что Signer
// принимает ecpair v3 и объектная форма sign проходит валидацию.

import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
// Легаси-модули btc17 — .js без d.ts (как и везде в этой папке).
// @ts-expect-error legacy js module without types
import { Signer } from './types.js'
// @ts-expect-error legacy js module without types
import { checkSignArgs } from './transaction-builder-sign.js'

const ECPair = ECPairFactory(ecc)

// Детерминированный приватный ключ (32 байта) — сеть для этого теста не важна.
const PRIV = new Uint8Array(Buffer.from('01'.repeat(32), 'hex'))

describe('btc17 Signer typeforce ↔ ecpair v3', () => {
  it('ecpair v3 отдаёт publicKey как Uint8Array (не Buffer) и без getPublicKey', () => {
    const ec = ECPair.fromPrivateKey(PRIV)
    expect(ec.publicKey instanceof Uint8Array).toBe(true)
    expect(Buffer.isBuffer(ec.publicKey)).toBe(false)
    expect(typeof ec.sign).toBe('function')
    expect((ec as unknown as { getPublicKey?: unknown }).getPublicKey).toBeUndefined()
  })

  it('Signer принимает ecpair v3 (Uint8Array pubkey + sign())', () => {
    const ec = ECPair.fromPrivateKey(PRIV)
    expect(Signer(ec)).toBe(true)
  })

  it('checkSignArgs не бросает для p2pkh с ecpair v3 (объектная форма sign)', () => {
    const ec = ECPair.fromPrivateKey(PRIV)
    const inputs = [{ prevOutType: 'pubkeyhash' }]
    expect(() =>
      checkSignArgs(inputs, { prevOutScriptType: 'p2pkh', vin: 0, keyPair: ec })
    ).not.toThrow()
  })

  it('Signer отвергает объект без sign()', () => {
    expect(Signer({ publicKey: Buffer.alloc(33) })).toBe(false)
  })
})
