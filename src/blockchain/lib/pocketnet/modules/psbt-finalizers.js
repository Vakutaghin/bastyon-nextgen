// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Финализация PSBT-input'а: проверка достаточности подписей (canFinalize),
// сборка финальных scriptSig + witness через payment factory (prepareFinalScripts),
// расчёт fee/feeRate с финализацией всех inputs (getTxCacheValue).

import * as payments from './payments/index.js'
import { hasSigs } from './psbt-internal-utils.js'
import { classifyScript } from './psbt-script-utils.js'
import { getPayment } from './psbt-payment-utils.js'
import { witnessStackToScriptWitness, inputFinalizeGetAmts } from './psbt-witness-utils.js'

export function isFinalized(input) {
  return !!input.finalScriptSig || !!input.finalScriptWitness
}

export function canFinalize(input, script, scriptType) {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig)
    case 'multisig':
      const p2ms = payments.p2ms({ output: script })
      return hasSigs(p2ms.m, input.partialSig, p2ms.pubkeys)
    default:
      return false
  }
}

export function getFinalScripts(inputIndex, input, script, isSegwit, isP2SH, isP2WSH) {
  const scriptType = classifyScript(script)
  if (!canFinalize(input, script, scriptType))
    throw new Error(`Can not finalize input #${inputIndex}`)
  return prepareFinalScripts(script, scriptType, input.partialSig, isSegwit, isP2SH, isP2WSH)
}

export function prepareFinalScripts(script, scriptType, partialSig, isSegwit, isP2SH, isP2WSH) {
  let finalScriptSig
  let finalScriptWitness
  const payment = getPayment(script, scriptType, partialSig)
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment })
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment })
  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness)
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness)
    }
    if (p2sh) {
      finalScriptSig = p2sh.input
    }
  } else {
    if (p2sh) {
      finalScriptSig = p2sh.input
    } else {
      finalScriptSig = payment.input
    }
  }
  return {
    finalScriptSig,
    finalScriptWitness,
  }
}

/**
 * Возвращает кэшированное `__FEE` / `__FEE_RATE`. Если нет — финализирует все
 * inputs (через {@link inputFinalizeGetAmts}) на копии Tx и кэширует результат.
 * Бросает, если PSBT не финализирован полностью.
 */
export function getTxCacheValue(key, name, inputs, c) {
  if (!inputs.every(isFinalized)) throw new Error(`PSBT must be finalized to calculate ${name}`)
  if (key === '__FEE_RATE' && c.__FEE_RATE) return c.__FEE_RATE
  if (key === '__FEE' && c.__FEE) return c.__FEE
  let tx
  let mustFinalize = true
  if (c.__EXTRACTED_TX) {
    tx = c.__EXTRACTED_TX
    mustFinalize = false
  } else {
    tx = c.__TX.clone()
  }
  inputFinalizeGetAmts(inputs, tx, c, mustFinalize)
  if (key === '__FEE_RATE') return c.__FEE_RATE
  else if (key === '__FEE') return c.__FEE
}
