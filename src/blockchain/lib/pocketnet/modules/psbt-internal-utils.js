// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Малые helpers, которые используются всеми psbt-* модулями. Извлечены из psbt.js
// при разбиении монолита по аудиту 2026-05-27. Логика идентична исходной.

import * as bscript from './script.js'
import * as payments from './payments/index.js'
import { Transaction } from './transaction.js'
import * as ecpair from './ecpair.js'

// --- index-guard helpers --------------------------------------------------

export function checkForInput(inputs, inputIndex) {
  const input = inputs[inputIndex]
  if (!input) throw new Error(`No input #${inputIndex}`)
  return input
}

export function checkForOutput(outputs, outputIndex) {
  const output = outputs[outputIndex]
  if (!output) throw new Error(`No output #${outputIndex}`)
  return output
}

export function checkHasKey(keyVal, keyData, keyArray) {
  if (keyVal.key[0] !== keyData) {
    throw new Error(`Invalid key for ${keyArray}`)
  }
}

export function range(n) {
  return [...Array(n).keys()]
}

export function check32Bit(num) {
  if (typeof num !== 'number' || num !== Math.floor(num) || num > 0xffffffff || num < 0) {
    throw new Error('Invalid 32 bit integer')
  }
}

// --- HD helpers -----------------------------------------------------------

export function bip32DerivationIsMine(root) {
  return (d) => {
    if (!d.masterFingerprint.equals(root.fingerprint)) return false
    if (!root.derivePath(d.path).publicKey.equals(d.pubkey)) return false
    return true
  }
}

// --- signature helpers ----------------------------------------------------

export function hasSigs(neededSigs, partialSig, pubkeys) {
  if (!partialSig) return false
  let sigs
  if (pubkeys) {
    sigs = pubkeys
      .map((pkey) => {
        const pubkey = ecpair.fromPublicKey(pkey, { compressed: true }).publicKey
        return partialSig.find((pSig) => pSig.pubkey.equals(pubkey))
      })
      .filter((v) => !!v)
  } else {
    sigs = partialSig
  }
  if (sigs.length > neededSigs) throw new Error('Too many signatures')
  return sigs.length === neededSigs
}

// --- payment-factory predicates ------------------------------------------

export function isPaymentFactory(payment) {
  return (script) => {
    try {
      payment({ output: script })
      return true
    } catch (err) {
      return false
    }
  }
}

export const isP2MS = isPaymentFactory(payments.p2ms)
export const isP2PK = isPaymentFactory(payments.p2pk)
export const isP2PKH = isPaymentFactory(payments.p2pkh)
export const isP2WPKH = isPaymentFactory(payments.p2wpkh)
export const isP2WSHScript = isPaymentFactory(payments.p2wsh)
export const isP2SHScript = isPaymentFactory(payments.p2sh)

// --- pubkey / signature shape predicates ---------------------------------

export function isPubkeyLike(buf) {
  return buf.length === 33 && bscript.isCanonicalPubKey(buf)
}

export function isSigLike(buf) {
  return bscript.isCanonicalScriptSignature(buf)
}

// --- script-checker factory (для P2SH/P2WSH согласований) ----------------

export function scriptCheckerFactory(payment, paymentScriptName) {
  return (inputIndex, scriptPubKey, redeemScript, ioType) => {
    const redeemScriptOutput = payment({
      redeem: { output: redeemScript },
    }).output
    if (!scriptPubKey.equals(redeemScriptOutput)) {
      throw new Error(
        `${paymentScriptName} for ${ioType} #${inputIndex} doesn't match the scriptPubKey in the prevout`
      )
    }
  }
}

export const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script')
export const checkWitnessScript = scriptCheckerFactory(payments.p2wsh, 'Witness script')

// --- sighash type → строковое имя (для error messages) --------------------

export function sighashTypeToString(sighashType) {
  let text = sighashType & Transaction.SIGHASH_ANYONECANPAY ? 'SIGHASH_ANYONECANPAY | ' : ''
  const sigMod = sighashType & 0x1f
  switch (sigMod) {
    case Transaction.SIGHASH_ALL:
      text += 'SIGHASH_ALL'
      break
    case Transaction.SIGHASH_SINGLE:
      text += 'SIGHASH_SINGLE'
      break
    case Transaction.SIGHASH_NONE:
      text += 'SIGHASH_NONE'
      break
  }
  return text
}
