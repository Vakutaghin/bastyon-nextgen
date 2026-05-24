import type { BaseRpcResponse, StandardRpcTime } from './common'

/**
 * scriptPubKey одного выхода. У OP_RETURN-выходов addresses обычно [""].
 */
export interface TxScriptPubKey {
  addresses: string[]
  hex: string
  /** Иногда нода добавляет ASM. */
  asm?: string
  type?: string
}

export interface TxVin {
  /** ID родительской транзакции, из выхода которой берётся монета. coinbase = пустая строка. */
  txid: string
  /** Индекс выхода в родительской транзакции. */
  vout: number
  /** Адрес, к которому принадлежал входной выход. */
  address?: string
  /** Сумма входа в PKOIN. */
  value?: number
  /** Coinbase-vin вместо txid содержит scriptSig.coinbase. */
  coinbase?: string
}

export interface TxVout {
  /** Индекс выхода. */
  n: number
  /** Сумма выхода в PKOIN (для OP_RETURN — 0). */
  value: number
  scriptPubKey: TxScriptPubKey
}

/**
 * Транзакция Pocketnet. Включает Bitcoin-поля + специфичные Pocketnet-поля:
 *  - type — числовой код типа транзакции (0/3 = pos/coinbase, 200 = post, 204 = comment,
 *    300 = upvoteShare, 301 = cScore, и т.д.).
 *  - s1..s5, i1..i5 — типизированные слоты для payload (зависит от type).
 *
 * Метод gettransactions(txids) принимает массив txid и возвращает массив транзакций
 * в том же порядке.
 */
export interface Transaction {
  txid: string
  type: number
  height: number
  blockHash: string
  /** Unix timestamp в секундах. */
  nTime: number
  /** Pocketnet payload-слоты (опциональны и зависят от type). */
  s1?: string
  s2?: string
  s3?: string
  s4?: string
  s5?: string
  i1?: number
  i2?: number
  i3?: number
  i4?: number
  i5?: number
  vin: TxVin[]
  vout: TxVout[]
  /** Индекс транзакции внутри блока (для пагинации getblocktransactions). */
  rowNumber?: number
}

export type GetTransactionsResponse = BaseRpcResponse<Transaction[], StandardRpcTime>

export type GetBlockTransactionsResponse = BaseRpcResponse<Transaction[], StandardRpcTime>
