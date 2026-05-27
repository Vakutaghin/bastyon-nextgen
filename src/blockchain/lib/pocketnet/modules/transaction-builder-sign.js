// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Логика подписи в TransactionBuilder: валидация sign-аргументов (checkSignArgs),
// готовность input'а к подписи (canSign), сама подпись (trySign), и orchestrator
// который превращает старый-style/новый-style sign() args в данные для trySign
// (getSigningData).

import * as bscript from './script.js'
import { Transaction } from './transaction.js'
import * as types from './types.js'
import * as typeforceModule from 'typeforce'
const typeforce = typeforceModule.default || typeforceModule
import { Buffer } from 'buffer'
import { PREVOUT_TYPES, tfMessage } from './transaction-builder-helpers.js'
import { prepareInput } from './transaction-builder-prep.js'

export function canSign(input) {
  return (
    input.signScript !== undefined &&
    input.signType !== undefined &&
    input.pubkeys !== undefined &&
    input.signatures !== undefined &&
    input.signatures.length === input.pubkeys.length &&
    input.pubkeys.length > 0 &&
    (input.hasWitness === false || input.value !== undefined)
  )
}

/**
 * Валидация sign(signParams) — проверяет согласованность prevOutScriptType с
 * фактическим prevOutType из inputs[vin], а также наличие/отсутствие
 * redeemScript/witnessScript/witnessValue для каждого типа.
 */
export function checkSignArgs(inputs, signParams) {
  if (!PREVOUT_TYPES.has(signParams.prevOutScriptType)) {
    throw new TypeError(`Unknown prevOutScriptType "${signParams.prevOutScriptType}"`)
  }
  tfMessage(
    typeforce.Number,
    signParams.vin,
    `sign must include vin parameter as Number (input index)`
  )
  tfMessage(
    types.Signer,
    signParams.keyPair,
    `sign must include keyPair parameter as Signer interface`
  )
  tfMessage(
    typeforce.maybe(typeforce.Number),
    signParams.hashType,
    `sign hashType parameter must be a number`
  )
  const prevOutType = (inputs[signParams.vin] || []).prevOutType
  const posType = signParams.prevOutScriptType
  switch (posType) {
    case 'p2pkh':
      if (prevOutType && prevOutType !== 'pubkeyhash') {
        throw new TypeError(`input #${signParams.vin} is not of type p2pkh: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.redeemScript,
        `${posType} requires NO redeemScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessValue,
        `${posType} requires NO witnessValue`
      )
      break
    case 'p2pk':
      if (prevOutType && prevOutType !== 'pubkey') {
        throw new TypeError(`input #${signParams.vin} is not of type p2pk: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.redeemScript,
        `${posType} requires NO redeemScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessValue,
        `${posType} requires NO witnessValue`
      )
      break
    case 'p2wpkh':
      if (prevOutType && prevOutType !== 'witnesspubkeyhash') {
        throw new TypeError(`input #${signParams.vin} is not of type p2wpkh: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.redeemScript,
        `${posType} requires NO redeemScript`
      )
      tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`)
      break
    case 'p2ms':
      if (prevOutType && prevOutType !== 'multisig') {
        throw new TypeError(`input #${signParams.vin} is not of type p2ms: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.redeemScript,
        `${posType} requires NO redeemScript`
      )
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessValue,
        `${posType} requires NO witnessValue`
      )
      break
    case 'p2sh-p2wpkh':
      if (prevOutType && prevOutType !== 'scripthash') {
        throw new TypeError(`input #${signParams.vin} is not of type p2sh-p2wpkh: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires redeemScript`)
      tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`)
      break
    case 'htlc':
      if (prevOutType && prevOutType !== 'htlc') {
        throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`)
      }
      /*tfMessage(
              typeforce.string,
              signParams.secret,
              `${posType} requires redeemScript`,
            );*/
      /* tfMessage(
               typeforce.Buffer,
               signParams.redeemScript,
               `${posType} requires redeemScript`,
             );*/
      break
    case 'p2sh-p2ms':
    case 'p2sh-p2pk':
    case 'p2sh-p2pkh':
      if (prevOutType && prevOutType !== 'scripthash') {
        throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`)
      }
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessScript,
        `${posType} requires NO witnessScript`
      )
      tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires redeemScript`)
      tfMessage(
        typeforce.value(undefined),
        signParams.witnessValue,
        `${posType} requires NO witnessValue`
      )
      break
    case 'p2wsh-p2ms':
    case 'p2wsh-p2pk':
    case 'p2wsh-p2pkh':
      if (prevOutType && prevOutType !== 'witnessscripthash') {
        throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`)
      }
      tfMessage(typeforce.Buffer, signParams.witnessScript, `${posType} requires witnessScript`)
      tfMessage(
        typeforce.value(undefined),
        signParams.redeemScript,
        `${posType} requires NO redeemScript`
      )
      tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`)
      break
    case 'p2sh-p2wsh-p2ms':
    case 'p2sh-p2wsh-p2pk':
    case 'p2sh-p2wsh-p2pkh':
      if (prevOutType && prevOutType !== 'scripthash') {
        throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`)
      }
      tfMessage(typeforce.Buffer, signParams.witnessScript, `${posType} requires witnessScript`)
      tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires witnessScript`)
      tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessScript`)
      break
  }
}

/**
 * Подписывает один input по pubkey: проходит по всем pubkeys и подписывает только
 * тот, который совпадает с ourPubKey. Бросает если ни один pubkey не подошёл или
 * подпись уже есть.
 */
export function trySign({ input, ourPubKey, keyPair, signatureHash, hashType, useLowR }, htlc) {
  // enforce in order signing of public keys
  let signed = false
  htlc = htlc
  for (const [i, pubKey] of input.pubkeys.entries()) {
    // Ensure pubKey is Buffer
    const pubKeyBuf = Buffer.isBuffer(pubKey) ? pubKey : Buffer.from(pubKey)
    const ourPubKeyBuf = Buffer.isBuffer(ourPubKey) ? ourPubKey : Buffer.from(ourPubKey)

    if (!ourPubKeyBuf.equals(pubKeyBuf)) continue
    if (input.signatures[i]) throw new Error('Signature already exists')
    // TODO: add tests
    if (ourPubKeyBuf.length !== 33 && input.hasWitness) {
      throw new Error('BIP143 rejects uncompressed public keys in P2WPKH or P2WSH')
    }
    const signature = keyPair.sign(signatureHash, useLowR)
    input.signatures[i] = bscript.signature.encode(signature, hashType)
    signed = true
  }
  if (!signed) throw new Error('Key pair cannot sign for this input')
}

/**
 * Превращает signParams (число | TxbSignArg) в полный signing-context для trySign.
 * Поддерживает обе сигнатуры sign(): legacy (vin как number + позиционные параметры)
 * и новую (объект {vin, keyPair, redeemScript, ...}).
 */
export function getSigningData(
  network,
  inputs,
  needsOutputs,
  tx,
  signParams,
  keyPair,
  redeemScript,
  hashType,
  witnessValue,
  witnessScript,
  useLowR
) {
  let vin
  if (typeof signParams === 'number') {
    console.warn(
      'DEPRECATED: TransactionBuilder sign method arguments ' +
        'will change in v6, please use the TxbSignArg interface'
    )
    vin = signParams
  } else if (typeof signParams === 'object') {
    checkSignArgs(inputs, signParams)
    ;({ vin, keyPair, redeemScript, hashType, witnessValue, witnessScript } = signParams)
  } else {
    throw new TypeError('TransactionBuilder sign first arg must be TxbSignArg or number')
  }
  if (keyPair === undefined) {
    throw new Error('sign requires keypair')
  }
  // TODO: remove keyPair.network matching in 4.0.0
  if (keyPair.network && keyPair.network !== network) {
    // Временное решение: игнорируем ошибку сети для POCKETNET_NETWORK
    // console.warn('Inconsistent network ignored:', keyPair.network, network);
  }
  // throw new TypeError('Inconsistent network');
  if (!inputs[vin]) throw new Error('No input at index: ' + vin)
  hashType = hashType || Transaction.SIGHASH_ALL
  if (needsOutputs(hashType)) throw new Error('Transaction needs outputs')
  const input = inputs[vin]
  // if redeemScript was previously provided, enforce consistency
  if (
    input.redeemScript !== undefined &&
    redeemScript &&
    !input.redeemScript.equals(redeemScript)
  ) {
    throw new Error('Inconsistent redeemScript')
  }
  let ourPubKey = keyPair.publicKey || (keyPair.getPublicKey && keyPair.getPublicKey())

  // Ensure ourPubKey is a Buffer (MUST be done before prepareInput)
  if (ourPubKey && !Buffer.isBuffer(ourPubKey)) {
    if (ourPubKey instanceof Uint8Array || Array.isArray(ourPubKey)) {
      ourPubKey = Buffer.from(ourPubKey)
      // Try to update keyPair if possible so future calls use Buffer
      try {
        if (keyPair.publicKey) keyPair.publicKey = ourPubKey
      } catch (e) {
        // Ignore proxy set errors or immutable objects
      }
    }
  }

  if (!ourPubKey || (Buffer.isBuffer(ourPubKey) && ourPubKey.length === 0)) {
    console.error('TransactionBuilder: KeyPair missing public key', keyPair)
    throw new Error('TransactionBuilder: KeyPair missing public key')
  }

  if (!canSign(input)) {
    if (witnessValue !== undefined) {
      if (input.value !== undefined && input.value !== witnessValue)
        throw new Error('Input did not match witnessValue')
      typeforce(types.Satoshi, witnessValue)
      input.value = witnessValue
    }
    if (!canSign(input)) {
      const prepared = prepareInput(input, ourPubKey, redeemScript, witnessScript)
      // updates inline
      Object.assign(input, prepared)
    }
    if (!canSign(input)) throw Error(input.prevOutType + ' not supported')
  }
  // ready to sign
  let signatureHash
  if (input.hasWitness) {
    signatureHash = tx.hashForWitnessV0(vin, input.signScript, input.value, hashType)
  } else {
    signatureHash = tx.hashForSignature(vin, input.signScript, hashType)
  }
  return {
    input,
    ourPubKey,
    keyPair,
    signatureHash,
    hashType,
    useLowR: !!useLowR,
  }
}
