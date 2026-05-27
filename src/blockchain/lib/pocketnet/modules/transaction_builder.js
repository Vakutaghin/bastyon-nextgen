// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Класс TransactionBuilder. Helpers разнесены по доменам:
// - transaction-builder-helpers.js — SCRIPT_TYPES / PREVOUT_TYPES, tfMessage,
//   txIsString/Transaction, signatureHashType, build (script assembly),
//   fixMultisigOrder
// - transaction-builder-prep.js    — expandInput / expandOutput / prepareInput
// - transaction-builder-sign.js    — canSign / checkSignArgs / trySign / getSigningData

import * as baddress from './address.js'
import * as bufferutils from './bufferutils.js'
import * as classify from './classify.js'
import * as networks from './networks.js'
import { Transaction } from './transaction.js'
import * as typeforceModule from 'typeforce'
const typeforce = typeforceModule.default || typeforceModule
import { Buffer } from 'buffer'
import {
  SCRIPT_TYPES,
  build,
  fixMultisigOrder,
  signatureHashType,
  txIsString,
  txIsTransaction,
} from './transaction-builder-helpers.js'
import { expandInput, expandOutput } from './transaction-builder-prep.js'
import { trySign, getSigningData } from './transaction-builder-sign.js'
import * as types from './types.js'

export class TransactionBuilder {
  // WARNING: maximumFeeRate is __NOT__ to be relied on,
  //          it's just another potential safety mechanism (safety in-depth)
  constructor(network = networks.bitcoin, maximumFeeRate = 2500) {
    this.network = network
    this.maximumFeeRate = maximumFeeRate
    this.__PREV_TX_SET = {}
    this.__INPUTS = []
    this.__TX = new Transaction()
    this.__TX.version = 2
    this.__TX.nTime = Math.floor(new Date().getTime() / 1000)
    this.__USE_LOW_R = false
  }
  static fromTransaction(transaction, network) {
    const txb = new TransactionBuilder(network)
    // Copy transaction fields
    txb.setVersion(transaction.version)
    txb.setLockTime(transaction.locktime)
    txb.setNTime(transaction.nTime)
    // Copy outputs (done first to avoid signature invalidation)
    transaction.outs.forEach((txOut) => {
      txb.addOutput(txOut.script, txOut.value)
    })
    // Copy inputs
    transaction.ins.forEach((txIn) => {
      txb.__addInputUnsafe(txIn.hash, txIn.index, {
        sequence: txIn.sequence,
        script: txIn.script,
        witness: txIn.witness,
      })
    })
    // fix some things not possible through the public API
    txb.__INPUTS.forEach((input, i) => {
      fixMultisigOrder(input, transaction, i)
    })
    return txb
  }
  setLowR(setting) {
    typeforce(typeforce.maybe(typeforce.Boolean), setting)
    if (setting === undefined) {
      setting = true
    }
    this.__USE_LOW_R = setting
    return setting
  }
  setLockTime(locktime) {
    typeforce(types.UInt32, locktime)
    // if any signatures exist, throw
    if (
      this.__INPUTS.some((input) => {
        if (!input.signatures) return false
        return input.signatures.some((s) => s !== undefined)
      })
    ) {
      throw new Error('No, this would invalidate signatures')
    }
    this.__TX.locktime = locktime
  }
  setNTime(time) {
    typeforce(types.UInt32, time)
    this.__TX.nTime = time
  }
  addNTime(time) {
    this.__TX.nTime = this.__TX.nTime + time
  }
  setVersion(version) {
    typeforce(types.UInt32, version)
    this.__TX.version = version
  }
  addInput(txHash, vout, sequence, prevOutScript, htlc) {
    if (!this.__canModifyInputs()) {
      throw new Error('No, this would invalidate signatures')
    }
    let value
    // is it a hex string?
    if (txIsString(txHash)) {
      // transaction hashs's are displayed in reverse order, un-reverse it
      txHash = bufferutils.reverseBuffer(Buffer.from(txHash, 'hex'))
      // is it a Transaction object?
    } else if (txIsTransaction(txHash)) {
      const txOut = txHash.outs[vout]
      prevOutScript = txOut.script
      value = txOut.value
      txHash = txHash.getHash(false)
    }
    return this.__addInputUnsafe(txHash, vout, {
      sequence,
      prevOutScript,
      value,
      htlc,
    })
  }
  addOutput(scriptPubKey, value) {
    if (!this.__canModifyOutputs()) {
      throw new Error('No, this would invalidate signatures')
    }
    // Attempt to get a script if it's a base58 or bech32 address string
    if (typeof scriptPubKey === 'string') {
      scriptPubKey = baddress.toOutputScript(scriptPubKey, this.network)
    }
    return this.__TX.addOutput(scriptPubKey, value)
  }
  build() {
    return this.__build(false)
  }
  buildIncomplete() {
    return this.__build(true)
  }
  sign(signParams, keyPair, redeemScript, hashType, witnessValue, witnessScript) {
    trySign(
      getSigningData(
        this.network,
        this.__INPUTS,
        this.__needsOutputs.bind(this),
        this.__TX,
        signParams,
        keyPair,
        redeemScript,
        hashType,
        witnessValue,
        witnessScript,
        this.__USE_LOW_R
      )
    )
  }
  __addInputUnsafe(txHash, vout, options) {
    if (Transaction.isCoinbaseHash(txHash)) {
      throw new Error('coinbase inputs not supported')
    }
    const prevTxOut = txHash.toString('hex') + ':' + vout
    if (this.__PREV_TX_SET[prevTxOut] !== undefined)
      throw new Error('Duplicate TxOut: ' + prevTxOut)
    let input = {}
    // derive what we can from the scriptSig ???
    if (options.script !== undefined) {
      input = expandInput(options.script, options.witness || [])
    }
    // if an input value was given, retain it
    if (options.value !== undefined) {
      input.value = options.value
    }
    if (options.htlc !== undefined) {
      input.htlc = options.htlc
    }
    // derive what we can from the previous transactions output script
    if (!input.prevOutScript && options.prevOutScript) {
      let prevOutType
      if (!input.pubkeys && !input.signatures) {
        const expanded = expandOutput(options.prevOutScript)
        if (expanded.pubkeys) {
          input.pubkeys = expanded.pubkeys
          input.signatures = expanded.signatures
        }
        prevOutType = expanded.type
      }
      input.prevOutScript = options.prevOutScript
      input.prevOutType = prevOutType || classify.output(options.prevOutScript)
    }
    const vin = this.__TX.addInput(txHash, vout, options.sequence, options.scriptSig)
    this.__INPUTS[vin] = input
    this.__PREV_TX_SET[prevTxOut] = true
    return vin
  }
  __build(allowIncomplete) {
    if (!allowIncomplete) {
      if (!this.__TX.ins.length) throw new Error('Transaction has no inputs')
      if (!this.__TX.outs.length) throw new Error('Transaction has no outputs')
    }
    const tx = this.__TX.clone()
    // create script signatures from inputs
    this.__INPUTS.forEach((input, i) => {
      if (!input.prevOutType && !allowIncomplete) throw new Error('Transaction is not complete')
      const result = build(input.prevOutType, input, allowIncomplete)
      if (!result) {
        if (!allowIncomplete && input.prevOutType === SCRIPT_TYPES.NONSTANDARD)
          throw new Error('Unknown input type')
        if (!allowIncomplete) throw new Error('Not enough information')
        return
      }
      tx.setInputScript(i, result.input)
      tx.setWitness(i, result.witness)
    })
    if (!allowIncomplete) {
      // do not rely on this, its merely a last resort
      if (this.__overMaximumFees(tx.virtualSize())) {
        throw new Error('Transaction has absurd fees')
      }
    }
    return tx
  }
  __canModifyInputs() {
    return this.__INPUTS.every((input) => {
      if (!input.signatures) return true
      return input.signatures.every((signature) => {
        if (!signature) return true
        const hashType = signatureHashType(signature)
        // if SIGHASH_ANYONECANPAY is set, signatures would not
        // be invalidated by more inputs
        return (hashType & Transaction.SIGHASH_ANYONECANPAY) !== 0
      })
    })
  }
  __needsOutputs(signingHashType) {
    if (signingHashType === Transaction.SIGHASH_ALL) {
      return this.__TX.outs.length === 0
    }
    // if inputs are being signed with SIGHASH_NONE, we don't strictly need outputs
    // .build() will fail, but .buildIncomplete() is OK
    return (
      this.__TX.outs.length === 0 &&
      this.__INPUTS.some((input) => {
        if (!input.signatures) return false
        return input.signatures.some((signature) => {
          if (!signature) return false // no signature, no issue
          const hashType = signatureHashType(signature)
          if (hashType & Transaction.SIGHASH_NONE) return false // SIGHASH_NONE doesn't care about outputs
          return true // SIGHASH_* does care
        })
      })
    )
  }
  __canModifyOutputs() {
    const nInputs = this.__TX.ins.length
    const nOutputs = this.__TX.outs.length
    return this.__INPUTS.every((input) => {
      if (input.signatures === undefined) return true
      return input.signatures.every((signature) => {
        if (!signature) return true
        const hashType = signatureHashType(signature)
        const hashTypeMod = hashType & 0x1f
        if (hashTypeMod === Transaction.SIGHASH_NONE) return true
        if (hashTypeMod === Transaction.SIGHASH_SINGLE) {
          // if SIGHASH_SINGLE is set, and nInputs > nOutputs
          // some signatures would be invalidated by the addition
          // of more outputs
          return nInputs <= nOutputs
        }
        return false
      })
    })
  }
  __overMaximumFees(bytes) {
    // not all inputs will have .value defined
    const incoming = this.__INPUTS.reduce((a, x) => a + (x.value >>> 0), 0)
    // but all outputs do, and if we have any input value
    // we can immediately determine if the outputs are too small
    const outgoing = this.__TX.outs.reduce((a, x) => a + x.value, 0)
    const fee = incoming - outgoing
    const feeRate = fee / bytes
    return feeRate > this.maximumFeeRate
  }
}
