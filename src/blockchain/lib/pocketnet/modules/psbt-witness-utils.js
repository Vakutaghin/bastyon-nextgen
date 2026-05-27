// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Witness-сериализация и финализация: чтение/запись witness-стека из buffer'а,
// инкрементальный расчёт __FEE / __FEE_RATE / __EXTRACTED_TX, кэширование
// non-witness UTXO транзакций через property getter (для lazy-rebuild buffer'а).

import * as varuint from './varuint.js'
import { Transaction } from './transaction.js'
import { Buffer } from 'buffer'

export function scriptWitnessToWitnessStack(buffer) {
  let offset = 0
  function readSlice(n) {
    offset += n
    return buffer.slice(offset - n, offset)
  }
  function readVarInt() {
    const vi = varuint.decode(buffer, offset)
    offset += varuint.decode.bytes
    return vi
  }
  function readVarSlice() {
    return readSlice(readVarInt())
  }
  function readVector() {
    const count = readVarInt()
    const vector = []
    for (let i = 0; i < count; i++) vector.push(readVarSlice())
    return vector
  }
  return readVector()
}

export function witnessStackToScriptWitness(witness) {
  let buffer = Buffer.allocUnsafe(0)
  function writeSlice(slice) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)])
  }
  function writeVarInt(i) {
    const currentLen = buffer.length
    const varintLen = varuint.encodingLength(i)
    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)])
    varuint.encode(i, buffer, currentLen)
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length)
    writeSlice(slice)
  }
  function writeVector(vector) {
    writeVarInt(vector.length)
    vector.forEach(writeVarSlice)
  }
  writeVector(witness)
  return buffer
}

/**
 * Кладёт `nonWitnessUtxo` буфер в кэш с lazy regeneration:
 * заменяем поле `input.nonWitnessUtxo` getter'ом, который при чтении
 * возвращает либо сохранённый buffer, либо пересобирает его из закэшированной Tx.
 * Это позволяет не держать дубликат buffer'а в памяти после декодирования.
 */
export function addNonWitnessTxCache(cache, input, inputIndex) {
  cache.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo
  const tx = Transaction.fromBuffer(input.nonWitnessUtxo)
  cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx
  const self = cache
  const selfIndex = inputIndex
  delete input.nonWitnessUtxo
  Object.defineProperty(input, 'nonWitnessUtxo', {
    enumerable: true,
    get() {
      const buf = self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex]
      const txCache = self.__NON_WITNESS_UTXO_TX_CACHE[selfIndex]
      if (buf !== undefined) {
        return buf
      } else {
        const newBuf = txCache.toBuffer()
        self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = newBuf
        return newBuf
      }
    },
    set(data) {
      self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data
    },
  })
}

export function nonWitnessUtxoTxFromCache(cache, input, inputIndex) {
  const c = cache.__NON_WITNESS_UTXO_TX_CACHE
  if (!c[inputIndex]) {
    addNonWitnessTxCache(cache, input, inputIndex)
  }
  return c[inputIndex]
}

export function inputFinalizeGetAmts(inputs, tx, cache, mustFinalize) {
  let inputAmount = 0
  inputs.forEach((input, idx) => {
    if (mustFinalize && input.finalScriptSig) tx.ins[idx].script = input.finalScriptSig
    if (mustFinalize && input.finalScriptWitness) {
      tx.ins[idx].witness = scriptWitnessToWitnessStack(input.finalScriptWitness)
    }
    if (input.witnessUtxo) {
      inputAmount += input.witnessUtxo.value
    } else if (input.nonWitnessUtxo) {
      const nwTx = nonWitnessUtxoTxFromCache(cache, input, idx)
      const vout = tx.ins[idx].index
      const out = nwTx.outs[vout]
      inputAmount += out.value
    }
  })
  const outputAmount = tx.outs.reduce((total, o) => total + o.value, 0)
  const fee = inputAmount - outputAmount
  if (fee < 0) {
    throw new Error('Outputs are spending more than Inputs')
  }
  const bytes = tx.virtualSize()
  cache.__FEE = fee
  cache.__EXTRACTED_TX = tx
  cache.__FEE_RATE = Math.floor(fee / bytes)
}
