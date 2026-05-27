// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Подпись input'а PSBT: получение hash + sighashType (с обработкой P2WPKH/P2WSH
// и нестандартного non-segwit signing), извлечение signer'ов из HD-ключа.

import * as payments from './payments/index.js'
import { Transaction } from './transaction.js'
import { checkForInput, isP2WPKH, sighashTypeToString } from './psbt-internal-utils.js'
import { getMeaningfulScript, pubkeyInScript, getScriptFromUtxo } from './psbt-script-utils.js'
import { nonWitnessUtxoTxFromCache } from './psbt-witness-utils.js'
import { checkScriptForPubkey } from './psbt-validators.js'

export function getHashAndSighashType(inputs, inputIndex, pubkey, cache, sighashTypes) {
  const input = checkForInput(inputs, inputIndex)
  const { hash, sighashType, script } = getHashForSig(inputIndex, input, cache, false, sighashTypes)
  checkScriptForPubkey(pubkey, script, 'sign')
  return {
    hash,
    sighashType,
  }
}

export function getHashForSig(inputIndex, input, cache, forValidate, sighashTypes) {
  const unsignedTx = cache.__TX
  const sighashType = input.sighashType || Transaction.SIGHASH_ALL
  if (sighashTypes && sighashTypes.indexOf(sighashType) < 0) {
    const str = sighashTypeToString(sighashType)
    throw new Error(
      `Sighash type is not allowed. Retry the sign method passing the ` +
        `sighashTypes array of whitelisted types. Sighash type: ${str}`
    )
  }
  let hash
  let prevout
  if (input.nonWitnessUtxo) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(cache, input, inputIndex)
    const prevoutHash = unsignedTx.ins[inputIndex].hash
    const utxoHash = nonWitnessUtxoTx.getHash()
    if (!prevoutHash.equals(utxoHash)) {
      throw new Error(
        `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`
      )
    }
    const prevoutIndex = unsignedTx.ins[inputIndex].index
    prevout = nonWitnessUtxoTx.outs[prevoutIndex]
  } else if (input.witnessUtxo) {
    prevout = input.witnessUtxo
  } else {
    throw new Error('Need a Utxo input item for signing')
  }
  const { meaningfulScript, type } = getMeaningfulScript(
    prevout.script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript
  )
  if (['p2sh-p2wsh', 'p2wsh'].indexOf(type) >= 0) {
    hash = unsignedTx.hashForWitnessV0(inputIndex, meaningfulScript, prevout.value, sighashType)
  } else if (isP2WPKH(meaningfulScript)) {
    const signingScript = payments.p2pkh({ hash: meaningfulScript.slice(2) }).output
    hash = unsignedTx.hashForWitnessV0(inputIndex, signingScript, prevout.value, sighashType)
  } else {
    if (input.nonWitnessUtxo === undefined && cache.__UNSAFE_SIGN_NONSEGWIT === false)
      throw new Error(
        `Input #${inputIndex} has witnessUtxo but non-segwit script: ` +
          `${meaningfulScript.toString('hex')}`
      )
    if (!forValidate && cache.__UNSAFE_SIGN_NONSEGWIT !== false)
      console.warn(
        'Warning: Signing non-segwit inputs without the full parent transaction ' +
          'means there is a chance that a miner could feed you incorrect information ' +
          'to trick you into paying large fees. This behavior is the same as the old ' +
          'TransactionBuilder class when signing non-segwit scripts. You are not ' +
          'able to export this Psbt with toBuffer|toBase64|toHex since it is not ' +
          'BIP174 compliant.\n*********************\nPROCEED WITH CAUTION!\n' +
          '*********************'
      )
    hash = unsignedTx.hashForSignature(inputIndex, meaningfulScript, sighashType)
  }
  return {
    script: meaningfulScript,
    sighashType,
    hash,
  }
}

export function getSignersFromHD(inputIndex, inputs, hdKeyPair) {
  const input = checkForInput(inputs, inputIndex)
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD')
  }
  const myDerivations = input.bip32Derivation
    .map((bipDv) => {
      if (bipDv.masterFingerprint.equals(hdKeyPair.fingerprint)) {
        return bipDv
      } else {
        return
      }
    })
    .filter((v) => !!v)
  if (myDerivations.length === 0) {
    throw new Error('Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint')
  }
  const signers = myDerivations.map((bipDv) => {
    const node = hdKeyPair.derivePath(bipDv.path)
    if (!bipDv.pubkey.equals(node.publicKey)) {
      throw new Error('pubkey did not match bip32Derivation')
    }
    return node
  })
  return signers
}

export function pubkeyInInput(pubkey, input, inputIndex, cache) {
  const script = getScriptFromUtxo(inputIndex, input, cache)
  const { meaningfulScript } = getMeaningfulScript(
    script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript
  )
  return pubkeyInScript(pubkey, meaningfulScript)
}

export function pubkeyInOutput(pubkey, output, outputIndex, cache) {
  const script = cache.__TX.outs[outputIndex].script
  const { meaningfulScript } = getMeaningfulScript(
    script,
    outputIndex,
    'output',
    output.redeemScript,
    output.witnessScript
  )
  return pubkeyInScript(pubkey, meaningfulScript)
}
