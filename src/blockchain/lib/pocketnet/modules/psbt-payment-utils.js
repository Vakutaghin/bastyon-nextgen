// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Сборка payment-объектов для подписи: для multisig/pubkey/pubkeyhash/witness
// формирует p2ms/p2pk/p2pkh/p2wpkh payment'ы из payments/. Также включает
// сортировку multisig-подписей по порядку pubkey'ев и извлечение partialSig
// из финализированных скриптов (для отката/валидации).

import * as bscript from './script.js'
import * as payments from './payments/index.js'
import { Buffer } from 'buffer'
import { isSigLike } from './psbt-internal-utils.js'

export function getPayment(script, scriptType, partialSig) {
  let payment
  switch (scriptType) {
    case 'multisig':
      const sigs = getSortedSigs(script, partialSig)
      payment = payments.p2ms({
        output: script,
        signatures: sigs,
      })
      break
    case 'pubkey':
      payment = payments.p2pk({
        output: script,
        signature: partialSig[0].signature,
      })
      break
    case 'pubkeyhash':
      payment = payments.p2pkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      })
      break
    case 'witnesspubkeyhash':
      payment = payments.p2wpkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      })
      break
  }
  return payment
}

/** Возвращает signatures в порядке pubkey'ев из p2ms.output (BIP-62 / BIP-67-compatible). */
export function getSortedSigs(script, partialSig) {
  const p2ms = payments.p2ms({ output: script })
  return p2ms.pubkeys
    .map((pk) => {
      return (
        partialSig.filter((ps) => {
          return ps.pubkey.equals(pk)
        })[0] || {}
      ).signature
    })
    .filter((v) => !!v)
}

/**
 * Извлекает partialSig из финализированных скриптов (finalScriptSig + finalScriptWitness).
 * Используется при проверке/откате PSBT, который уже финализирован.
 */
export function getPsigsFromInputFinalScripts(input) {
  const scriptItems = !input.finalScriptSig ? [] : bscript.decompile(input.finalScriptSig) || []
  const witnessItems = !input.finalScriptWitness
    ? []
    : bscript.decompile(input.finalScriptWitness) || []
  return scriptItems
    .concat(witnessItems)
    .filter((item) => {
      return Buffer.isBuffer(item) && isSigLike(item)
    })
    .map((sig) => ({ signature: sig }))
}
