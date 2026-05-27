// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Утилитарные helpers TransactionBuilder'а: type-guards (txIsString/Transaction),
// typeforce-wrapper с кастомным message (tfMessage), парсер sighash type из
// signature buffer, constants (SCRIPT_TYPES / PREVOUT_TYPES), сборка итоговых
// scriptSig/witness по prevOutType (build).

import * as classify from './classify.js'
import * as payments from './payments/index.js'
import * as script_1 from './script.js'
import * as bscript from './script.js'
import { ECPair } from './ecpair.js'
import { Transaction } from './transaction.js'
import * as typeforceModule from 'typeforce'
const typeforce = typeforceModule.default || typeforceModule

export const SCRIPT_TYPES = classify.types

export const PREVOUT_TYPES = new Set([
  // Raw
  'p2pkh',
  'p2pk',
  'p2wpkh',
  'p2ms',
  'htlc',
  // P2SH wrapped
  'p2sh-htlc',
  'p2sh-p2pkh',
  'p2sh-p2pk',
  'p2sh-p2wpkh',
  'p2sh-p2ms',
  // P2WSH wrapped
  'p2wsh-p2pkh',
  'p2wsh-p2pk',
  'p2wsh-p2ms',
  // P2SH-P2WSH wrapper
  'p2sh-p2wsh-p2pkh',
  'p2sh-p2wsh-p2pk',
  'p2sh-p2wsh-p2ms',
])

export function tfMessage(type, value, message) {
  try {
    typeforce(type, value)
  } catch (err) {
    throw new Error(message)
  }
}

export function txIsString(tx) {
  return typeof tx === 'string' || tx instanceof String
}

export function txIsTransaction(tx) {
  return tx instanceof Transaction
}

/** Извлекает sighash-flag из последнего байта DER+sighash-encoded signature. */
export function signatureHashType(buffer) {
  return buffer.readUInt8(buffer.length - 1)
}

/**
 * Сборка итогового scriptSig/witness по типу + накопленным подписям.
 * Рекурсивно разворачивает P2SH/P2WSH через внутренние redeem/witnessScript.
 * Возвращает payment-объект ({input, witness}) или undefined, если не хватает данных.
 */
export function build(type, input, allowIncomplete) {
  const pubkeys = input.pubkeys || []
  let signatures = input.signatures || []
  switch (type) {
    case SCRIPT_TYPES.P2PKH: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break
      return payments.p2pkh({ pubkey: pubkeys[0], signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2WPKH: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break
      return payments.p2wpkh({ pubkey: pubkeys[0], signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2PK: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break
      return payments.p2pk({ signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2MS: {
      const m = input.maxSignatures
      if (allowIncomplete) {
        signatures = signatures.map((x) => x || script_1.OPS.OP_0)
      } else {
        signatures = signatures.filter((x) => x)
      }
      // if the transaction is not not complete (complete), or if signatures.length === m, validate
      // otherwise, the number of OP_0's may be >= m, so don't validate (boo)
      const validate = !allowIncomplete || m === signatures.length
      return payments.p2ms.p2ms({ m, pubkeys, signatures }, { allowIncomplete, validate })
    }
    case SCRIPT_TYPES.HTLC: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break
      let htlc = input.htlc
      return payments.htlc({
        pubkey: pubkeys[0],
        signature: signatures[0],
        htlc: htlc,
      })
    }
    case SCRIPT_TYPES.P2SH: {
      const redeem = build(input.redeemScriptType, input, allowIncomplete)
      if (!redeem) return
      return payments.p2sh({
        redeem: {
          output: redeem.output || input.redeemScript,
          input: redeem.input,
          witness: redeem.witness,
        },
      })
    }
    case SCRIPT_TYPES.P2WSH: {
      const redeem = build(input.witnessScriptType, input, allowIncomplete)
      if (!redeem) return
      return payments.p2wsh({
        redeem: {
          output: input.witnessScript,
          input: redeem.input,
          witness: redeem.witness,
        },
      })
    }
  }
}

/**
 * Восстанавливает порядок multisig подписей по pubkey'ям после копирования из
 * существующей транзакции (signatures могут прийти в другом порядке).
 */
export function fixMultisigOrder(input, transaction, vin) {
  if (input.redeemScriptType !== SCRIPT_TYPES.P2MS || !input.redeemScript) return
  if (input.pubkeys.length === input.signatures.length) return
  const unmatched = input.signatures.concat()
  input.signatures = input.pubkeys.map((pubKey) => {
    const keyPair = ECPair.fromPublicKey(pubKey)
    let match
    // check for a signature
    unmatched.some((signature, i) => {
      // skip if undefined || OP_0
      if (!signature) return false
      // TODO: avoid O(n) hashForSignature
      const parsed = bscript.signature.decode(signature)
      const hash = transaction.hashForSignature(vin, input.redeemScript, parsed.hashType)
      // skip if signature does not match pubKey
      if (!keyPair.verify(hash, parsed.signature)) return false
      // remove matched signature from unmatched
      unmatched[i] = undefined
      match = signature
      return true
    })
    return match
  })
}
