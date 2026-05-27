// LEGACY LIB COPY — часть кастомного Pocketnet bitcoinjs-lib (btc17).
// Wrapper над Transaction, который реализует minimum API, ожидаемый bip174:
// getInputOutputCounts / addInput / addOutput / toBuffer. Используется в качестве
// transaction-builder для класса Psbt.

import * as bufferutils from './bufferutils.js'
import { Transaction } from './transaction.js'
import { Buffer } from 'buffer'
import { checkTxEmpty } from './psbt-validators.js'

export class PsbtTransaction {
  constructor(buffer = Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])) {
    this.tx = Transaction.fromBuffer(buffer)
    checkTxEmpty(this.tx)
    Object.defineProperty(this, 'tx', {
      enumerable: false,
      writable: true,
    })
  }
  getInputOutputCounts() {
    return {
      inputCount: this.tx.ins.length,
      outputCount: this.tx.outs.length,
    }
  }
  addInput(input) {
    if (
      input.hash === undefined ||
      input.index === undefined ||
      (!Buffer.isBuffer(input.hash) && typeof input.hash !== 'string') ||
      typeof input.index !== 'number'
    ) {
      throw new Error('Error adding input.')
    }
    const hash =
      typeof input.hash === 'string'
        ? bufferutils.reverseBuffer(Buffer.from(input.hash, 'hex'))
        : input.hash
    this.tx.addInput(hash, input.index, input.sequence)
  }
  addOutput(output) {
    if (
      output.script === undefined ||
      output.value === undefined ||
      !Buffer.isBuffer(output.script) ||
      typeof output.value !== 'number'
    ) {
      throw new Error('Error adding output.')
    }
    this.tx.addOutput(output.script, output.value)
  }
  toBuffer() {
    return this.tx.toBuffer()
  }
}

export const transactionFromBuffer = (buffer) => new PsbtTransaction(buffer)
