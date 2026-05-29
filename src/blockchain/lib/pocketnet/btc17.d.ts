// Минимальный тип-stub для вендоренного btc17.js (форк bitcoinjs-lib от Pocketnet с поддержкой nTime).
// Покрывает только публичный API, который реально используется в src/blockchain/. См. CODE_AUDIT.md §2.
// При расширении использования API — дополнять этот стаб точечно, а не возвращать `any`.

import type { Buffer as NodeBuffer } from 'buffer'

// Совместим с `Signer` из `ecpair` (publicKey: Uint8Array; sign(hash, lowR?) => Uint8Array).
// `network` намеренно `unknown` — у ECPair это `Network`, btc17 им не пользуется.
export interface BtcSigner {
  publicKey: Uint8Array
  sign: (hash: Uint8Array, lowR?: boolean) => Uint8Array
  network?: unknown
}

export interface BtcNetwork {
  messagePrefix?: string
  bech32?: string
  bip32?: { public: number; private: number }
  pubKeyHash: number
  scriptHash: number
  wif: number
}

export interface BtcTransaction {
  toHex: () => string
}

export declare class BtcTransactionBuilder {
  constructor(network: BtcNetwork)
  addNTime: (time: number) => void
  setLockTime?: (time: number) => void
  setNTime?: (time: number) => void
  addInput: (txid: string, vout: number, sequence: number | null, scriptPubKey?: NodeBuffer) => void
  addOutput: (addressOrScript: string | NodeBuffer, amount: number) => void
  sign: (index: number, signer: BtcSigner) => void
  build: () => BtcTransaction
}

export interface BtcPayments {
  embed: (opts: { data: NodeBuffer[] }) => { output?: NodeBuffer }
}

export interface BtcCrypto {
  sha256: (data: NodeBuffer) => NodeBuffer
  hash256?: (data: NodeBuffer | string) => NodeBuffer
}

export interface PocketnetBitcoin {
  TransactionBuilder: typeof BtcTransactionBuilder
  payments: BtcPayments
  crypto: BtcCrypto
  // Прочие экспорты (bip32, bip39, ECPair, networks, script, ecc, Block, Psbt, Transaction,
  // opcodes, address, makeRandom) — описывать по мере необходимости.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

declare const bitcoin: PocketnetBitcoin
export default bitcoin
export const TransactionBuilder: typeof BtcTransactionBuilder
export const payments: BtcPayments
export const crypto: BtcCrypto
