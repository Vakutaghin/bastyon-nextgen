// Классификация транзакции для истории кошелька: входящая/исходящая/внутренняя.
//
// Логика 1:1 с legacy components/transactionslist/index.js:20-68:
//   fromMe = есть ли вход с одного из моих адресов;
//   in  — не от меня, но есть выход на мой адрес (получено);
//   out — от меня и есть выходы НЕ на мои адреса (отправлено);
//   change — всё остальное (внутренний перевод / комиссия за пост/коммент/голос).
// amount = сумма «релевантных» выходов (для in — на меня, для out — на других).

import type { Transaction, TxVout } from '@/types/rpc-responses/get-transactions'

export type WalletTxDirection = 'in' | 'out' | 'change'

/** Семантика по on-chain типу tx (надёжно есть в ответе getaddresstransactions). */
export type WalletTxSemantic = 'boost' | 'stake' | null

export interface ClassifiedWalletTx {
  direction: WalletTxDirection
  /** Сумма движения в PKOIN. Для in/out всегда > 0; для change — 0. */
  amount: number
  /** Адреса контрагентов (для in — отправители, для out — получатели). */
  counterparties: string[]
  /** boost (type 307) / stake-coinstake (type 3) / null. Донат не детектится —
   *  его маркер `a:donate` в message, которого нет в этом ответе. */
  semantic: WalletTxSemantic
}

/** boost = 307 (BoostContent), stake = 3 (coinstake). */
function semanticOf(type: number): WalletTxSemantic {
  if (type === 307) return 'boost'
  if (type === 3) return 'stake'
  return null
}

/** Адрес выхода (у OP_RETURN-выходов — пустой). */
function voutAddress(out: TxVout): string {
  return out.scriptPubKey?.addresses?.[0] || ''
}

export function classifyWalletTx(tx: Transaction, mine: ReadonlySet<string>): ClassifiedWalletTx {
  const vin = tx.vin || []
  const vout = tx.vout || []
  const fromMe = vin.some((i) => !!i.address && mine.has(i.address))

  let valueouts: TxVout[]
  let forMe: boolean
  if (!fromMe) {
    valueouts = vout.filter((o) => mine.has(voutAddress(o)))
    forMe = valueouts.length > 0
  } else {
    valueouts = vout.filter((o) => !mine.has(voutAddress(o)))
    forMe = valueouts.length === 0
  }

  let direction: WalletTxDirection = 'change'
  if (fromMe && !forMe) direction = 'out'
  else if (!fromMe && forMe) direction = 'in'

  const amount = valueouts.reduce((s, o) => s + (o.value || 0), 0)

  const counterpartyAddrs =
    direction === 'in' ? vin.map((i) => i.address || '') : valueouts.map(voutAddress)
  const counterparties = Array.from(new Set(counterpartyAddrs.filter((a) => a && !mine.has(a))))

  return { direction, amount, counterparties, semantic: semanticOf(tx.type) }
}
