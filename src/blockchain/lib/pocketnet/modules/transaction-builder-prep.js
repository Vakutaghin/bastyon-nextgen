// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Подготовка input'ов к подписи: reverse-engineering scriptSig/witness в
// pubkeys/signatures (expandInput), извлечение pubkeys из scriptPubKey
// (expandOutput), и финальная склейка с redeem/witness scripts в форму,
// пригодную для signing (prepareInput).

import * as classify from './classify.js'
import * as bcrypto from './crypto.js'
import * as payments from './payments/index.js'
import * as bscript from './script.js'
import * as types from './types.js'
import * as typeforceModule from 'typeforce'
const typeforce = typeforceModule.default || typeforceModule
import { SCRIPT_TYPES } from './transaction-builder-helpers.js'

/** Reverse-engineering scriptSig + witness → pubkeys/signatures для known типов. */
export function expandInput(scriptSig, witnessStack, type, scriptPubKey) {
  if (scriptSig.length === 0 && witnessStack.length === 0) return {}
  if (!type) {
    let ssType = classify.input(scriptSig, true)
    let wsType = classify.witness(witnessStack, true)
    if (ssType === SCRIPT_TYPES.NONSTANDARD) ssType = undefined
    if (wsType === SCRIPT_TYPES.NONSTANDARD) wsType = undefined
    type = ssType || wsType
  }
  switch (type) {
    case SCRIPT_TYPES.P2WPKH: {
      const { output, pubkey, signature } = payments.p2wpkh({
        witness: witnessStack,
      })
      return {
        prevOutScript: output,
        prevOutType: SCRIPT_TYPES.P2WPKH,
        pubkeys: [pubkey],
        signatures: [signature],
      }
    }
    case SCRIPT_TYPES.P2PKH: {
      const { output, pubkey, signature } = payments.p2pkh({
        input: scriptSig,
      })
      return {
        prevOutScript: output,
        prevOutType: SCRIPT_TYPES.P2PKH,
        pubkeys: [pubkey],
        signatures: [signature],
      }
    }
    case SCRIPT_TYPES.P2PK: {
      const { signature } = payments.p2pk({ input: scriptSig })
      return {
        prevOutType: SCRIPT_TYPES.P2PK,
        pubkeys: [undefined],
        signatures: [signature],
      }
    }
    case SCRIPT_TYPES.P2MS: {
      const { m, pubkeys, signatures } = payments.p2ms(
        {
          input: scriptSig,
          output: scriptPubKey,
        },
        { allowIncomplete: true }
      )
      return {
        prevOutType: SCRIPT_TYPES.P2MS,
        pubkeys,
        signatures,
        maxSignatures: m,
      }
    }
  }
  if (type === SCRIPT_TYPES.P2SH) {
    const { output, redeem } = payments.p2sh({
      input: scriptSig,
      witness: witnessStack,
    })
    const outputType = classify.output(redeem.output)
    const expanded = expandInput(redeem.input, redeem.witness, outputType, redeem.output)
    if (!expanded.prevOutType) return {}
    return {
      prevOutScript: output,
      prevOutType: SCRIPT_TYPES.P2SH,
      redeemScript: redeem.output,
      redeemScriptType: expanded.prevOutType,
      witnessScript: expanded.witnessScript,
      witnessScriptType: expanded.witnessScriptType,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
    }
  }
  if (type === SCRIPT_TYPES.P2WSH) {
    const { output, redeem } = payments.p2wsh({
      input: scriptSig,
      witness: witnessStack,
    })
    const outputType = classify.output(redeem.output)
    let expanded
    if (outputType === SCRIPT_TYPES.P2WPKH) {
      expanded = expandInput(redeem.input, redeem.witness, outputType)
    } else {
      expanded = expandInput(bscript.compile(redeem.witness), [], outputType, redeem.output)
    }
    if (!expanded.prevOutType) return {}
    return {
      prevOutScript: output,
      prevOutType: SCRIPT_TYPES.P2WSH,
      witnessScript: redeem.output,
      witnessScriptType: expanded.prevOutType,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
    }
  }
  return {
    prevOutType: SCRIPT_TYPES.NONSTANDARD,
    prevOutScript: scriptSig,
  }
}

/** Классификация scriptPubKey + достать pubkeys (если возможны без приватных данных). */
export function expandOutput(script, ourPubKey) {
  typeforce(types.Buffer, script)
  const type = classify.output(script)
  switch (type) {
    case SCRIPT_TYPES.HTLC: {
      if (!ourPubKey) return { type }
      return {
        type,
        pubkeys: [ourPubKey],
        signatures: [undefined],
      }
    }
    case SCRIPT_TYPES.P2PKH: {
      if (!ourPubKey) return { type }
      // does our hash160(pubKey) match the output scripts?
      const pkh1 = payments.p2pkh({ output: script }).hash
      const pkh2 = bcrypto.hash160(ourPubKey)
      if (!pkh1.equals(pkh2)) {
        console.error('P2PKH mismatch:', pkh1.toString('hex'), pkh2.toString('hex'))
        return { type }
      }
      return {
        type,
        pubkeys: [ourPubKey],
        signatures: [undefined],
      }
    }
    case SCRIPT_TYPES.P2WPKH: {
      if (!ourPubKey) return { type }
      // does our hash160(pubKey) match the output scripts?
      const wpkh1 = payments.p2wpkh({ output: script }).hash
      const wpkh2 = bcrypto.hash160(ourPubKey)
      if (!wpkh1.equals(wpkh2)) return { type }
      return {
        type,
        pubkeys: [ourPubKey],
        signatures: [undefined],
      }
    }
    case SCRIPT_TYPES.P2PK: {
      const p2pk = payments.p2pk({ output: script })
      return {
        type,
        pubkeys: [p2pk.pubkey],
        signatures: [undefined],
      }
    }
    case SCRIPT_TYPES.P2MS: {
      const p2ms = payments.p2ms({ output: script })
      return {
        type,
        pubkeys: p2ms.pubkeys,
        signatures: p2ms.pubkeys.map(() => undefined),
        maxSignatures: p2ms.m,
      }
    }
  }
  return { type }
}

/**
 * Подготовка input'а к подписи: учитывает возможную вложенность P2SH/P2WSH/
 * P2SH-P2WSH, разворачивает witnessScript/redeemScript, выставляет signScript
 * + hasWitness. Бросает если конструкция несогласованная (например,
 * P2SH-P2WSH-P2WPKH — consensus failure).
 */
export function prepareInput(input, ourPubKey, redeemScript, witnessScript) {
  if (redeemScript && witnessScript) {
    const p2wsh = payments.p2wsh({
      redeem: { output: witnessScript },
    })
    const p2wshAlt = payments.p2wsh({ output: redeemScript })
    const p2sh = payments.p2sh({ redeem: { output: redeemScript } })
    const p2shAlt = payments.p2sh({ redeem: p2wsh })
    // enforces P2SH(P2WSH(...))
    if (!p2wsh.hash.equals(p2wshAlt.hash))
      throw new Error('Witness script inconsistent with prevOutScript')
    if (!p2sh.hash.equals(p2shAlt.hash))
      throw new Error('Redeem script inconsistent with prevOutScript')
    const expanded = expandOutput(p2wsh.redeem.output, ourPubKey)
    if (!expanded.pubkeys)
      throw new Error(
        expanded.type + ' not supported as witnessScript (' + bscript.toASM(witnessScript) + ')'
      )
    if (input.signatures && input.signatures.some((x) => x !== undefined)) {
      expanded.signatures = input.signatures
    }
    const signScript = witnessScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH)
      throw new Error('P2SH(P2WSH(P2WPKH)) is a consensus failure')
    return {
      redeemScript,
      redeemScriptType: SCRIPT_TYPES.P2WSH,
      witnessScript,
      witnessScriptType: expanded.type,
      prevOutType: SCRIPT_TYPES.P2SH,
      prevOutScript: p2sh.output,
      hasWitness: true,
      signScript,
      signType: expanded.type,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures,
    }
  }
  if (redeemScript) {
    const expanded = expandOutput(redeemScript, ourPubKey)
    let payment = null
    let paymentAlt = null
    let paymentconst
    if (expanded.type == SCRIPT_TYPES.P2SH) {
      paymentconst = payments.p2sh.p2sh
    }
    if (!paymentconst) paymentconst = payments.p2sh.p2sh
    payment = paymentconst({ redeem: { output: redeemScript } })
    if (paymentconst) {
      if (input.prevOutScript) {
        try {
          paymentAlt = paymentconst({ output: input.prevOutScript })
        } catch (e) {
          throw new Error('PrevOutScript must be P2SH')
        }
        if (!payment.hash.equals(paymentAlt.hash))
          throw new Error('Redeem script inconsistent with prevOutScript')
      }
    }
    if (!expanded.pubkeys)
      throw new Error(
        expanded.type + ' not supported as redeemScript (' + bscript.toASM(redeemScript) + ')'
      )
    if (input.signatures && input.signatures.some((x) => x !== undefined)) {
      expanded.signatures = input.signatures
    }
    let signScript = redeemScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) {
      signScript = payments.p2pkh.p2pkh({ pubkey: expanded.pubkeys[0] }).output
    }
    return {
      redeemScript,
      redeemScriptType: expanded.type,
      prevOutType: SCRIPT_TYPES.P2SH,
      prevOutScript: payment.output,
      hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
      signScript,
      signType: expanded.type,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures,
    }
  }
  if (witnessScript) {
    const p2wsh = payments.p2wsh.p2wsh({ redeem: { output: witnessScript } })
    if (input.prevOutScript) {
      const p2wshAlt = payments.p2wsh.p2wsh({ output: input.prevOutScript })
      if (!p2wsh.hash.equals(p2wshAlt.hash))
        throw new Error('Witness script inconsistent with prevOutScript')
    }
    const expanded = expandOutput(p2wsh.redeem.output, ourPubKey)
    if (!expanded.pubkeys)
      throw new Error(
        expanded.type + ' not supported as witnessScript (' + bscript.toASM(witnessScript) + ')'
      )
    if (input.signatures && input.signatures.some((x) => x !== undefined)) {
      expanded.signatures = input.signatures
    }
    const signScript = witnessScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH)
      throw new Error('P2WSH(P2WPKH) is a consensus failure')
    return {
      witnessScript,
      witnessScriptType: expanded.type,
      prevOutType: SCRIPT_TYPES.P2WSH,
      prevOutScript: p2wsh.output,
      hasWitness: true,
      signScript,
      signType: expanded.type,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures,
    }
  }
  if (input.prevOutType && input.prevOutScript) {
    // embedded scripts are not possible without extra information
    /*if (input.prevOutType === SCRIPT_TYPES.HTLC)
        throw new Error(
          'PrevOutScript is ' + input.prevOutType + ', requires redeemScript',
        );*/
    if (input.prevOutType === SCRIPT_TYPES.P2SH)
      throw new Error('PrevOutScript is ' + input.prevOutType + ', requires redeemScript')
    if (input.prevOutType === SCRIPT_TYPES.P2WSH)
      throw new Error('PrevOutScript is ' + input.prevOutType + ', requires witnessScript')
    if (!input.prevOutScript) throw new Error('PrevOutScript is missing')
    const expanded = expandOutput(input.prevOutScript, ourPubKey)
    if (!expanded.pubkeys)
      throw new Error(expanded.type + ' not supported (' + bscript.toASM(input.prevOutScript) + ')')
    if (input.signatures && input.signatures.some((x) => x !== undefined)) {
      expanded.signatures = input.signatures
    }
    let signScript = input.prevOutScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) {
      signScript = payments.p2pkh.p2pkh({ pubkey: expanded.pubkeys[0] }).output
    }
    return {
      prevOutType: expanded.type,
      prevOutScript: input.prevOutScript,
      hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
      signScript,
      signType: expanded.type,
      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures,
    }
  }
  const prevOutScript = payments.p2pkh.p2pkh({ pubkey: ourPubKey }).output
  return {
    prevOutType: SCRIPT_TYPES.P2PKH,
    prevOutScript,
    hasWitness: false,
    signScript: prevOutScript,
    signType: SCRIPT_TYPES.P2PKH,
    pubkeys: [ourPubKey],
    signatures: [undefined],
  }
}
