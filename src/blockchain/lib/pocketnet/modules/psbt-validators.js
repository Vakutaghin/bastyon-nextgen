// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Validation helpers: проверки PSBT перед мутацией (partialSig sanity для
// модифицирующих операций), проверка fee против maximumFeeRate, проверка
// duplicate inputs, валидация sighash mismatch, проверка пустого Transaction.

import * as bscript from './script.js'
import * as bufferutils from './bufferutils.js'
import { Transaction } from './transaction.js'
import { Buffer } from 'buffer'
import { getPsigsFromInputFinalScripts } from './psbt-payment-utils.js'
import { pubkeyInScript } from './psbt-script-utils.js'

export function checkFees(psbt, cache, opts) {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate()
  const vsize = cache.__EXTRACTED_TX.virtualSize()
  const satoshis = feeRate * vsize
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`
    )
  }
}

/**
 * Запрещает мутировать поля PSBT, если уже есть partialSig с несовместимым
 * sighash flag'ом (ANYONECANPAY/SINGLE/NONE определяют, какие операции допустимы).
 */
export function checkInputsForPartialSig(inputs, action) {
  inputs.forEach((input) => {
    let throws = false
    let pSigs = []
    if ((input.partialSig || []).length === 0) {
      if (!input.finalScriptSig && !input.finalScriptWitness) return
      pSigs = getPsigsFromInputFinalScripts(input)
    } else {
      pSigs = input.partialSig
    }
    pSigs.forEach((pSig) => {
      const { hashType } = bscript.signature.decode(pSig.signature)
      const whitelist = []
      const isAnyoneCanPay = hashType & Transaction.SIGHASH_ANYONECANPAY
      if (isAnyoneCanPay) whitelist.push('addInput')
      const hashMod = hashType & 0x1f
      switch (hashMod) {
        case Transaction.SIGHASH_ALL:
          break
        case Transaction.SIGHASH_SINGLE:
        case Transaction.SIGHASH_NONE:
          whitelist.push('addOutput')
          whitelist.push('setInputSequence')
          break
      }
      if (whitelist.indexOf(action) === -1) {
        throws = true
      }
    })
    if (throws) {
      throw new Error('Can not modify transaction, signatures exist.')
    }
  })
}

export function checkPartialSigSighashes(input) {
  if (!input.sighashType || !input.partialSig) return
  const { partialSig, sighashType } = input
  partialSig.forEach((pSig) => {
    const { hashType } = bscript.signature.decode(pSig.signature)
    if (sighashType !== hashType) {
      throw new Error('Signature sighash does not match input sighash type')
    }
  })
}

export function checkScriptForPubkey(pubkey, script, action) {
  if (!pubkeyInScript(pubkey, script)) {
    throw new Error(`Can not ${action} for this input with the key ${pubkey.toString('hex')}`)
  }
}

export function checkTxEmpty(tx) {
  const isEmpty = tx.ins.every(
    (input) =>
      input.script && input.script.length === 0 && input.witness && input.witness.length === 0
  )
  if (!isEmpty) {
    throw new Error('Format Error: Transaction ScriptSigs are not empty')
  }
}

export function checkTxForDupeIns(tx, cache) {
  tx.ins.forEach((input) => {
    checkTxInputCache(cache, input)
  })
}

export function checkTxInputCache(cache, input) {
  const key = bufferutils.reverseBuffer(Buffer.from(input.hash)).toString('hex') + ':' + input.index
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.')
  cache.__TX_IN_CACHE[key] = 1
}

export function checkCache(cache) {
  if (cache.__UNSAFE_SIGN_NONSEGWIT !== false) {
    throw new Error('Not BIP174 compliant, can not export')
  }
}
