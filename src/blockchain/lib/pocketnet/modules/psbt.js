// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Класс Psbt (BIP-174 wrapper). Helpers разнесены по доменам:
// - psbt-internal-utils.js — pervasive helpers (checkForInput, range, isP2x, …)
// - psbt-validators.js     — checkFees / checkInputsForPartialSig / checkScriptForPubkey / …
// - psbt-finalizers.js     — getFinalScripts / canFinalize / isFinalized / getTxCacheValue
// - psbt-signers.js        — getHashAndSighashType / getHashForSig / getSignersFromHD / pubkeyIn{Input,Output}
// - psbt-script-utils.js   — getMeaningfulScript / classifyScript / getScriptFrom{Input,Utxo} / redeemFrom*
// - psbt-witness-utils.js  — scriptWitnessToWitnessStack / inputFinalizeGetAmts / nonWitnessUtxoTx*
// - psbt-payment-utils.js  — getPayment / getSortedSigs / getPsigsFromInputFinalScripts
// - psbt-transaction.js    — PsbtTransaction (внутренняя обёртка Transaction для bip174)

import * as bufferutils from './bufferutils.js'
import * as address from './address.js'
import * as networks from './networks.js'
import * as bscript from './script.js'
import { Transaction } from './transaction.js'
import * as ecpair from './ecpair.js'
import { Psbt as PsbtBase } from 'bip174'
import { Buffer } from 'buffer'

import {
  checkForInput,
  checkForOutput,
  check32Bit,
  bip32DerivationIsMine,
  range,
} from './psbt-internal-utils.js'
import {
  checkFees,
  checkInputsForPartialSig,
  checkPartialSigSighashes,
  checkScriptForPubkey,
  checkTxForDupeIns,
  checkTxInputCache,
  checkCache,
} from './psbt-validators.js'
import { getFinalScripts, isFinalized, getTxCacheValue } from './psbt-finalizers.js'
import {
  getHashAndSighashType,
  getHashForSig,
  getSignersFromHD,
  pubkeyInInput,
  pubkeyInOutput,
} from './psbt-signers.js'
import {
  getMeaningfulScript,
  classifyScript,
  getScriptFromInput,
  getScriptFromUtxo,
  redeemFromFinalScriptSig,
  redeemFromFinalWitnessScript,
  checkInvalidP2WSH,
} from './psbt-script-utils.js'
import { inputFinalizeGetAmts, addNonWitnessTxCache } from './psbt-witness-utils.js'
import { PsbtTransaction, transactionFromBuffer } from './psbt-transaction.js'

const DEFAULT_OPTS = {
  network: networks.bitcoin,
  maximumFeeRate: 5000,
}

export class Psbt {
  constructor(opts = {}, data = new PsbtBase(new PsbtTransaction())) {
    this.data = data
    this.opts = Object.assign({}, DEFAULT_OPTS, opts)
    this.__CACHE = {
      __NON_WITNESS_UTXO_TX_CACHE: [],
      __NON_WITNESS_UTXO_BUF_CACHE: [],
      __TX_IN_CACHE: {},
      __TX: this.data.globalMap.unsignedTx.tx,
      __UNSAFE_SIGN_NONSEGWIT: false,
    }
    if (this.data.inputs.length === 0) this.setVersion(2)
    const dpew = (obj, attr, enumerable, writable) =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      })
    dpew(this, '__CACHE', false, true)
    dpew(this, 'opts', false, true)
  }

  static fromBase64(data, opts = {}) {
    const buffer = Buffer.from(data, 'base64')
    return this.fromBuffer(buffer, opts)
  }

  static fromHex(data, opts = {}) {
    const buffer = Buffer.from(data, 'hex')
    return this.fromBuffer(buffer, opts)
  }

  static fromBuffer(buffer, opts = {}) {
    const psbtBase = PsbtBase.fromBuffer(buffer, transactionFromBuffer)
    const psbt = new Psbt(opts, psbtBase)
    checkTxForDupeIns(psbt.__CACHE.__TX, psbt.__CACHE)
    return psbt
  }

  get inputCount() {
    return this.data.inputs.length
  }

  get version() {
    return this.__CACHE.__TX.version
  }

  set version(version) {
    this.setVersion(version)
  }

  get locktime() {
    return this.__CACHE.__TX.locktime
  }

  set locktime(locktime) {
    this.setLocktime(locktime)
  }

  get txInputs() {
    return this.__CACHE.__TX.ins.map((input) => ({
      hash: bufferutils.cloneBuffer(input.hash),
      index: input.index,
      sequence: input.sequence,
    }))
  }

  get txOutputs() {
    return this.__CACHE.__TX.outs.map((output) => {
      let addr
      try {
        addr = address.fromOutputScript(output.script, this.opts.network)
      } catch (_) {}
      return {
        script: bufferutils.cloneBuffer(output.script),
        value: output.value,
        address: addr,
      }
    })
  }

  combine(...those) {
    this.data.combine(...those.map((o) => o.data))
    return this
  }

  clone() {
    const res = Psbt.fromBuffer(this.data.toBuffer())
    res.opts = JSON.parse(JSON.stringify(this.opts))
    return res
  }

  setMaximumFeeRate(satoshiPerByte) {
    check32Bit(satoshiPerByte)
    this.opts.maximumFeeRate = satoshiPerByte
  }

  setVersion(version) {
    check32Bit(version)
    checkInputsForPartialSig(this.data.inputs, 'setVersion')
    const c = this.__CACHE
    c.__TX.version = version
    c.__EXTRACTED_TX = undefined
    return this
  }

  setLocktime(locktime) {
    check32Bit(locktime)
    checkInputsForPartialSig(this.data.inputs, 'setLocktime')
    const c = this.__CACHE
    c.__TX.locktime = locktime
    c.__EXTRACTED_TX = undefined
    return this
  }

  setInputSequence(inputIndex, sequence) {
    check32Bit(sequence)
    checkInputsForPartialSig(this.data.inputs, 'setInputSequence')
    const c = this.__CACHE
    if (c.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high')
    }
    c.__TX.ins[inputIndex].sequence = sequence
    c.__EXTRACTED_TX = undefined
    return this
  }

  addInputs(inputDatas) {
    inputDatas.forEach((inputData) => this.addInput(inputData))
    return this
  }

  addInput(inputData) {
    if (
      arguments.length > 1 ||
      !inputData ||
      inputData.hash === undefined ||
      inputData.index === undefined
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addInput. ` +
          `Requires single object with at least [hash] and [index]`
      )
    }
    checkInputsForPartialSig(this.data.inputs, 'addInput')
    if (inputData.witnessScript) checkInvalidP2WSH(inputData.witnessScript)
    const c = this.__CACHE
    this.data.addInput(inputData)
    const txIn = c.__TX.ins[c.__TX.ins.length - 1]
    checkTxInputCache(c, txIn)
    const inputIndex = this.data.inputs.length - 1
    const input = this.data.inputs[inputIndex]
    if (input.nonWitnessUtxo) {
      addNonWitnessTxCache(this.__CACHE, input, inputIndex)
    }
    c.__FEE = undefined
    c.__FEE_RATE = undefined
    c.__EXTRACTED_TX = undefined
    return this
  }

  addOutputs(outputDatas) {
    outputDatas.forEach((outputData) => this.addOutput(outputData))
    return this
  }

  addOutput(outputData) {
    if (
      arguments.length > 1 ||
      !outputData ||
      outputData.value === undefined ||
      (outputData.address === undefined && outputData.script === undefined)
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addOutput. ` +
          `Requires single object with at least [script or address] and [value]`
      )
    }
    checkInputsForPartialSig(this.data.inputs, 'addOutput')
    const { address: addr } = outputData
    if (typeof addr === 'string') {
      const { network } = this.opts
      const script = address.toOutputScript(addr, network)
      outputData = Object.assign(outputData, { script })
    }
    const c = this.__CACHE
    this.data.addOutput(outputData)
    c.__FEE = undefined
    c.__FEE_RATE = undefined
    c.__EXTRACTED_TX = undefined
    return this
  }

  extractTransaction(disableFeeCheck) {
    if (!this.data.inputs.every(isFinalized)) throw new Error('Not finalized')
    const c = this.__CACHE
    if (!disableFeeCheck) {
      checkFees(this, c, this.opts)
    }
    if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX
    const tx = c.__TX.clone()
    inputFinalizeGetAmts(this.data.inputs, tx, c, true)
    return tx
  }

  getFeeRate() {
    return getTxCacheValue('__FEE_RATE', 'fee rate', this.data.inputs, this.__CACHE)
  }

  getFee() {
    return getTxCacheValue('__FEE', 'fee', this.data.inputs, this.__CACHE)
  }

  finalizeAllInputs() {
    checkForInput(this.data.inputs, 0)
    range(this.data.inputs.length).forEach((idx) => this.finalizeInput(idx))
    return this
  }

  finalizeInput(inputIndex, finalScriptsFunc = getFinalScripts) {
    const input = checkForInput(this.data.inputs, inputIndex)
    const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
      inputIndex,
      input,
      this.__CACHE
    )
    if (!script) throw new Error(`No script found for input #${inputIndex}`)
    checkPartialSigSighashes(input)
    const { finalScriptSig, finalScriptWitness } = finalScriptsFunc(
      inputIndex,
      input,
      script,
      isSegwit,
      isP2SH,
      isP2WSH
    )
    if (finalScriptSig) this.data.updateInput(inputIndex, { finalScriptSig })
    if (finalScriptWitness) this.data.updateInput(inputIndex, { finalScriptWitness })
    if (!finalScriptSig && !finalScriptWitness)
      throw new Error(`Unknown error finalizing input #${inputIndex}`)
    this.data.clearFinalizedInput(inputIndex)
    return this
  }

  getInputType(inputIndex) {
    const input = checkForInput(this.data.inputs, inputIndex)
    const script = getScriptFromUtxo(inputIndex, input, this.__CACHE)
    const result = getMeaningfulScript(
      script,
      inputIndex,
      'input',
      input.redeemScript || redeemFromFinalScriptSig(input.finalScriptSig),
      input.witnessScript || redeemFromFinalWitnessScript(input.finalScriptWitness)
    )
    const type = result.type === 'raw' ? '' : result.type + '-'
    const mainType = classifyScript(result.meaningfulScript)
    return type + mainType
  }

  inputHasPubkey(inputIndex, pubkey) {
    const input = checkForInput(this.data.inputs, inputIndex)
    return pubkeyInInput(pubkey, input, inputIndex, this.__CACHE)
  }

  inputHasHDKey(inputIndex, root) {
    const input = checkForInput(this.data.inputs, inputIndex)
    const derivationIsMine = bip32DerivationIsMine(root)
    return !!input.bip32Derivation && input.bip32Derivation.some(derivationIsMine)
  }

  outputHasPubkey(outputIndex, pubkey) {
    const output = checkForOutput(this.data.outputs, outputIndex)
    return pubkeyInOutput(pubkey, output, outputIndex, this.__CACHE)
  }

  outputHasHDKey(outputIndex, root) {
    const output = checkForOutput(this.data.outputs, outputIndex)
    const derivationIsMine = bip32DerivationIsMine(root)
    return !!output.bip32Derivation && output.bip32Derivation.some(derivationIsMine)
  }

  validateSignaturesOfAllInputs() {
    checkForInput(this.data.inputs, 0)
    const results = range(this.data.inputs.length).map((idx) => this.validateSignaturesOfInput(idx))
    return results.reduce((final, res) => res === true && final, true)
  }

  validateSignaturesOfInput(inputIndex, pubkey) {
    const input = this.data.inputs[inputIndex]
    const partialSig = (input || {}).partialSig
    if (!input || !partialSig || partialSig.length < 1) throw new Error('No signatures to validate')
    const mySigs = pubkey ? partialSig.filter((sig) => sig.pubkey.equals(pubkey)) : partialSig
    if (mySigs.length < 1) throw new Error('No signatures for this pubkey')
    const results = []
    let hashCache
    let scriptCache
    let sighashCache
    for (const pSig of mySigs) {
      const sig = bscript.signature.decode(pSig.signature)
      const { hash, script } =
        sighashCache !== sig.hashType
          ? getHashForSig(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE,
              true
            )
          : { hash: hashCache, script: scriptCache }
      sighashCache = sig.hashType
      hashCache = hash
      scriptCache = script
      checkScriptForPubkey(pSig.pubkey, script, 'verify')
      const keypair = ecpair.fromPublicKey(pSig.pubkey)
      results.push(keypair.verify(hash, sig.signature))
    }
    return results.every((res) => res === true)
  }

  signAllInputsHD(hdKeyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input')
    }
    const results = []
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInputHD(i, hdKeyPair, sighashTypes)
        results.push(true)
      } catch (err) {
        results.push(false)
      }
    }
    if (results.every((v) => v === false)) {
      throw new Error('No inputs were signed')
    }
    return this
  }

  signAllInputsHDAsync(hdKeyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    return new Promise((resolve, reject) => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'))
      }
      const results = []
      const promises = []
      for (const i of range(this.data.inputs.length)) {
        promises.push(
          this.signInputHDAsync(i, hdKeyPair, sighashTypes).then(
            () => {
              results.push(true)
            },
            () => {
              results.push(false)
            }
          )
        )
      }
      return Promise.all(promises).then(() => {
        if (results.every((v) => v === false)) {
          return reject(new Error('No inputs were signed'))
        }
        resolve()
      })
    })
  }

  signInputHD(inputIndex, hdKeyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input')
    }
    const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair)
    signers.forEach((signer) => this.signInput(inputIndex, signer, sighashTypes))
    return this
  }

  signInputHDAsync(inputIndex, hdKeyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    return new Promise((resolve, reject) => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'))
      }
      const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair)
      const promises = signers.map((signer) =>
        this.signInputAsync(inputIndex, signer, sighashTypes)
      )
      return Promise.all(promises)
        .then(() => {
          resolve()
        })
        .catch(reject)
    })
  }

  signAllInputs(keyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    if (!keyPair || !keyPair.publicKey) throw new Error('Need Signer to sign input')
    const results = []
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInput(i, keyPair, sighashTypes)
        results.push(true)
      } catch (err) {
        results.push(false)
      }
    }
    if (results.every((v) => v === false)) {
      throw new Error('No inputs were signed')
    }
    return this
  }

  signAllInputsAsync(keyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    return new Promise((resolve, reject) => {
      if (!keyPair || !keyPair.publicKey) return reject(new Error('Need Signer to sign input'))
      const results = []
      const promises = []
      for (const [i] of this.data.inputs.entries()) {
        promises.push(
          this.signInputAsync(i, keyPair, sighashTypes).then(
            () => {
              results.push(true)
            },
            () => {
              results.push(false)
            }
          )
        )
      }
      return Promise.all(promises).then(() => {
        if (results.every((v) => v === false)) {
          return reject(new Error('No inputs were signed'))
        }
        resolve()
      })
    })
  }

  signInput(inputIndex, keyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    if (!keyPair || !keyPair.publicKey) throw new Error('Need Signer to sign input')
    const { hash, sighashType } = getHashAndSighashType(
      this.data.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__CACHE,
      sighashTypes
    )
    const partialSig = [
      {
        pubkey: keyPair.publicKey,
        signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
      },
    ]
    this.data.updateInput(inputIndex, { partialSig })
    return this
  }

  signInputAsync(inputIndex, keyPair, sighashTypes = [Transaction.SIGHASH_ALL]) {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey) throw new Error('Need Signer to sign input')
      const { hash, sighashType } = getHashAndSighashType(
        this.data.inputs,
        inputIndex,
        keyPair.publicKey,
        this.__CACHE,
        sighashTypes
      )
      return Promise.resolve(keyPair.sign(hash)).then((signature) => {
        const partialSig = [
          {
            pubkey: keyPair.publicKey,
            signature: bscript.signature.encode(signature, sighashType),
          },
        ]
        this.data.updateInput(inputIndex, { partialSig })
      })
    })
  }

  toBuffer() {
    checkCache(this.__CACHE)
    return this.data.toBuffer()
  }

  toHex() {
    checkCache(this.__CACHE)
    return this.data.toHex()
  }

  toBase64() {
    checkCache(this.__CACHE)
    return this.data.toBase64()
  }

  updateGlobal(updateData) {
    this.data.updateGlobal(updateData)
    return this
  }

  updateInput(inputIndex, updateData) {
    if (updateData.witnessScript) checkInvalidP2WSH(updateData.witnessScript)
    this.data.updateInput(inputIndex, updateData)
    if (updateData.nonWitnessUtxo) {
      addNonWitnessTxCache(this.__CACHE, this.data.inputs[inputIndex], inputIndex)
    }
    return this
  }

  updateOutput(outputIndex, updateData) {
    this.data.updateOutput(outputIndex, updateData)
    return this
  }

  addUnknownKeyValToGlobal(keyVal) {
    this.data.addUnknownKeyValToGlobal(keyVal)
    return this
  }

  addUnknownKeyValToInput(inputIndex, keyVal) {
    this.data.addUnknownKeyValToInput(inputIndex, keyVal)
    return this
  }

  addUnknownKeyValToOutput(outputIndex, keyVal) {
    this.data.addUnknownKeyValToOutput(outputIndex, keyVal)
    return this
  }

  clearFinalizedInput(inputIndex) {
    this.data.clearFinalizedInput(inputIndex)
    return this
  }
}

// Re-exports — PsbtTransaction экспортируется для совместимости с любым кодом,
// который мог его импортировать напрямую из psbt.js.
export { PsbtTransaction } from './psbt-transaction.js'
