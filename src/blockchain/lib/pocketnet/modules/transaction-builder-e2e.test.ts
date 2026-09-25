// End-to-end подпись на НАСТОЯЩЕМ btc17 TransactionBuilder (не моке) с ключом
// ecpair v3 (Uint8Array pubkey/подпись). Покрывает всю цепочку, которую
// transaction-builder.test.ts мокает FakeTxBuilder'ом: checkSignArgs → Signer →
// getSigningData (Uint8Array→Buffer) → prepareInput/expandOutput
// (hash160/payments.p2pkh) → trySign (.equals + keyPair.sign) →
// script_signature.encode → build().toHex(). Обе формы sign(): объектная
// (контентные транзакции, build-content-transaction) и позиционная (переводы).

import { describe, it, expect } from 'vitest'
import { Buffer } from 'buffer'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { POCKETNET_NETWORK } from '@/blockchain/constants/network'
// @ts-expect-error legacy js module without types
import { TransactionBuilder } from './transaction_builder.js'
// @ts-expect-error legacy js module without types
import { Transaction } from './transaction.js'
// @ts-expect-error legacy js module without types
import * as payments from './payments/index.js'
// @ts-expect-error legacy js module without types
import * as bscript from './script.js'

// btc17 и typeforce в приложении живут с ОДНИМ Buffer — npm-полифиллом, который
// polyfills.ts делает глобальным. В Node глобальный Buffer другой класс, а
// typeforce проверяет именно глобальный → «Expected Buffer, got Buffer».
// Повторяем окружение приложения (глобалы у vitest — per-file).
;(globalThis as unknown as { Buffer: unknown }).Buffer = Buffer

const ECPair = ECPairFactory(ecc)
const PRIV = new Uint8Array(Buffer.from('02'.repeat(32), 'hex'))
const PREV_TXID = 'aa'.repeat(32)
const AMOUNT = 100_000 // сатоши на входе
const FEE = 1_000

/** p2pkh-выход на наш ключ (scriptPubKey предыдущей транзакции). */
function ourPrevOutScript(pubkey: Uint8Array): Buffer {
  const { output } = payments.p2pkh({ pubkey: Buffer.from(pubkey), network: POCKETNET_NETWORK })
  return output as Buffer
}

function buildUnsigned(prevOut: Buffer) {
  const txb = new TransactionBuilder(POCKETNET_NETWORK)
  if (typeof txb.addNTime === 'function') txb.addNTime(0)
  txb.addInput(PREV_TXID, 0, null, prevOut)
  txb.addOutput(prevOut, AMOUNT - FEE) // сдача на тот же скрипт — самый простой выход
  return txb
}

/** Проверяет, что scriptSig входа = <sig> <pubkey> и подпись верифицируется. */
function assertSignedByUs(hex: string, pubkey: Uint8Array, prevOut: Buffer) {
  const tx = Transaction.fromHex(hex)
  expect(tx.ins).toHaveLength(1)
  const chunks = bscript.decompile(tx.ins[0].script) as Array<Buffer | number>
  expect(chunks).toHaveLength(2)
  const [sigChunk, pubChunk] = chunks as [Buffer, Buffer]
  expect(Buffer.from(pubChunk).equals(Buffer.from(pubkey))).toBe(true)

  // DER-подпись + hashType → raw 64 байта, сверяем с sighash входа.
  const { signature, hashType } = bscript.signature.decode(Buffer.from(sigChunk))
  expect(hashType).toBe(Transaction.SIGHASH_ALL)
  const sighash = tx.hashForSignature(0, prevOut, hashType)
  expect(ecc.verify(sighash, pubkey, signature)).toBe(true)
}

describe('btc17 TransactionBuilder ↔ ecpair v3 (end-to-end)', () => {
  it('объектная форма sign({prevOutScriptType,vin,keyPair}) — как контентные транзакции', () => {
    const kp = ECPair.fromPrivateKey(PRIV, { network: POCKETNET_NETWORK })
    const prevOut = ourPrevOutScript(kp.publicKey)
    const txb = buildUnsigned(prevOut)
    expect(() => txb.sign({ prevOutScriptType: 'p2pkh', vin: 0, keyPair: kp })).not.toThrow()
    const hex = txb.build().toHex()
    assertSignedByUs(hex, kp.publicKey, prevOut)
  })

  it('позиционная форма sign(vin, keyPair) — совместимость библиотеки (приложение подписывает объектной)', () => {
    const kp = ECPair.fromPrivateKey(PRIV, { network: POCKETNET_NETWORK })
    const prevOut = ourPrevOutScript(kp.publicKey)
    const txb = buildUnsigned(prevOut)
    txb.sign(0, kp)
    assertSignedByUs(txb.build().toHex(), kp.publicKey, prevOut)
  })

  it('чужой ключ не может подписать наш p2pkh-вход', () => {
    const kp = ECPair.fromPrivateKey(PRIV, { network: POCKETNET_NETWORK })
    const other = ECPair.fromPrivateKey(new Uint8Array(Buffer.from('03'.repeat(32), 'hex')), {
      network: POCKETNET_NETWORK,
    })
    const txb = buildUnsigned(ourPrevOutScript(kp.publicKey))
    // btc17 формулирует это как «pubkeyhash not supported (<script>)»: хеш чужого
    // pubkey не совпал с prevOutScript, input не расширился под подпись.
    expect(() => txb.sign({ prevOutScriptType: 'p2pkh', vin: 0, keyPair: other })).toThrow(
      /not supported|cannot sign/i
    )
  })
})
