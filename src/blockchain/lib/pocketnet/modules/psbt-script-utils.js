// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Анализ scriptPubKey / redeem / witness scripts: вычисление "meaningful script"
// для P2SH / P2WSH / P2SH-P2WSH вложенности, классификация типа, проверка
// присутствия pubkey, извлечение redeem из финального скрипта/witness.

import * as bscript from './script.js'
import { Buffer } from 'buffer'
import * as crypto from './crypto.js'
import {
  isP2MS,
  isP2PK,
  isP2PKH,
  isP2WPKH,
  isP2WSHScript,
  isP2SHScript,
  isPubkeyLike,
  isSigLike,
  checkRedeemScript,
  checkWitnessScript,
} from './psbt-internal-utils.js'
import { scriptWitnessToWitnessStack, nonWitnessUtxoTxFromCache } from './psbt-witness-utils.js'

/**
 * Для входа определяет «значимый» скрипт (тот, по которому реально подписываем)
 * с учётом возможной вложенности P2SH/P2WSH/P2SH-P2WSH. Параллельно валидирует
 * соответствие redeem/witness своему scriptPubKey/redeem.
 */
export function getMeaningfulScript(script, index, ioType, redeemScript, witnessScript) {
  const isP2SH = isP2SHScript(script)
  const isP2SHP2WSH = isP2SH && redeemScript && isP2WSHScript(redeemScript)
  const isP2WSH = isP2WSHScript(script)
  if (isP2SH && redeemScript === undefined)
    throw new Error('scriptPubkey is P2SH but redeemScript missing')
  if ((isP2WSH || isP2SHP2WSH) && witnessScript === undefined)
    throw new Error('scriptPubkey or redeemScript is P2WSH but witnessScript missing')
  let meaningfulScript
  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript
    checkRedeemScript(index, script, redeemScript, ioType)
    checkWitnessScript(index, redeemScript, witnessScript, ioType)
    checkInvalidP2WSH(meaningfulScript)
  } else if (isP2WSH) {
    meaningfulScript = witnessScript
    checkWitnessScript(index, script, witnessScript, ioType)
    checkInvalidP2WSH(meaningfulScript)
  } else if (isP2SH) {
    meaningfulScript = redeemScript
    checkRedeemScript(index, script, redeemScript, ioType)
  } else {
    meaningfulScript = script
  }
  return {
    meaningfulScript,
    type: isP2SHP2WSH ? 'p2sh-p2wsh' : isP2SH ? 'p2sh' : isP2WSH ? 'p2wsh' : 'raw',
  }
}

export function checkInvalidP2WSH(script) {
  if (isP2WPKH(script) || isP2SHScript(script)) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH')
  }
}

export function pubkeyInScript(pubkey, script) {
  const pubkeyHash = crypto.hash160(pubkey)
  const decompiled = bscript.decompile(script)
  if (decompiled === null) throw new Error('Unknown script error')
  return decompiled.some((element) => {
    if (typeof element === 'number') return false
    return element.equals(pubkey) || element.equals(pubkeyHash)
  })
}

export function classifyScript(script) {
  if (isP2WPKH(script)) return 'witnesspubkeyhash'
  if (isP2PKH(script)) return 'pubkeyhash'
  if (isP2MS(script)) return 'multisig'
  if (isP2PK(script)) return 'pubkey'
  return 'nonstandard'
}

/**
 * Восстанавливает scriptPubKey/redeem/witnessScript для подписи из PSBT-input'а:
 * учитывает приоритет witness > redeem > UTXO.script, выставляет флаги isP2SH/isP2WSH/isSegwit.
 */
export function getScriptFromInput(inputIndex, input, cache) {
  const unsignedTx = cache.__TX
  const res = {
    script: null,
    isSegwit: false,
    isP2SH: false,
    isP2WSH: false,
  }
  res.isP2SH = !!input.redeemScript
  res.isP2WSH = !!input.witnessScript
  if (input.witnessScript) {
    res.script = input.witnessScript
  } else if (input.redeemScript) {
    res.script = input.redeemScript
  } else {
    if (input.nonWitnessUtxo) {
      const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(cache, input, inputIndex)
      const prevoutIndex = unsignedTx.ins[inputIndex].index
      res.script = nonWitnessUtxoTx.outs[prevoutIndex].script
    } else if (input.witnessUtxo) {
      res.script = input.witnessUtxo.script
    }
  }
  if (input.witnessScript || isP2WPKH(res.script)) {
    res.isSegwit = true
  }
  return res
}

export function getScriptFromUtxo(inputIndex, input, cache) {
  if (input.witnessUtxo !== undefined) {
    return input.witnessUtxo.script
  } else if (input.nonWitnessUtxo !== undefined) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(cache, input, inputIndex)
    return nonWitnessUtxoTx.outs[cache.__TX.ins[inputIndex].index].script
  } else {
    throw new Error("Can't find pubkey in input without Utxo data")
  }
}

export function redeemFromFinalScriptSig(finalScript) {
  if (!finalScript) return
  const decomp = bscript.decompile(finalScript)
  if (!decomp) return
  const lastItem = decomp[decomp.length - 1]
  if (!Buffer.isBuffer(lastItem) || isPubkeyLike(lastItem) || isSigLike(lastItem)) return
  const sDecomp = bscript.decompile(lastItem)
  if (!sDecomp) return
  return lastItem
}

export function redeemFromFinalWitnessScript(finalScript) {
  if (!finalScript) return
  const decomp = scriptWitnessToWitnessStack(finalScript)
  const lastItem = decomp[decomp.length - 1]
  if (isPubkeyLike(lastItem)) return
  const sDecomp = bscript.decompile(lastItem)
  if (!sDecomp) return
  return lastItem
}
