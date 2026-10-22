// Классификация транзакции для истории кошелька: входящая/исходящая/внутренняя.
//
// Основа — legacy components/transactionslist/index.js:20-68:
//   fromMe = есть ли вход с одного из моих адресов;
//   in  — не от меня, но есть выход на мой адрес (получено);
//   out — от меня и есть выходы НЕ на мои адреса (отправлено);
//   change — всё остальное (внутренний перевод / свои посты, оценки, подписки).
// amount = сумма «релевантных» выходов (для in — на меня, для out — на других).
//
// Сверх legacy, по транзакциям mainnet (22.10.2026):
//   - выход без адреса (OP_RETURN, пустой первый выход coinstake) — не адресат;
//   - буст (208): выходов на чужие адреса нет, сумма буста — комиссия;
//   - свой coinstake (3): награда = выходы мне − мои входы;
//   - чужой coinstake с выходом мне — выигрыш лотереи блока;
//   - комментарий (204) с выходом автору поста — донат.

import type { Transaction, TxVout } from '@/types/rpc-responses/get-transactions'
import {
  DONATE_MARKER,
  MONETIZATION_MARKER,
  SUBSCRIPTION_MARKER,
  txOpReturnText,
} from '@/helpers/common/op-return'

export type WalletTxDirection = 'in' | 'out' | 'change'

/**
 * Смысл движения: по типу транзакции (буст, стейкинг, лотерея, донат в
 * комментарии) или по метке в OP_RETURN перевода: `a:donate` — чаевые,
 * `a:subscription` — оплата платной подписки, `a:monetization` — выплата
 * монетизации авторам.
 */
export type WalletTxSemantic =
  | 'boost'
  | 'stake'
  | 'lottery'
  | 'comment'
  | 'donate'
  | 'subscription'
  | 'monetization'
  | null

export interface ClassifiedWalletTx {
  direction: WalletTxDirection
  /** Сумма движения в PKOIN. Для in/out всегда > 0; для change — 0. */
  amount: number
  /** Адреса контрагентов (для in — отправители, для out — получатели). */
  counterparties: string[]
  semantic: WalletTxSemantic
}

/** Типы транзакций, в которых двигаются монеты: их и просит история у ноды. */
export const TX_TYPE = {
  transfer: 1,
  coinbase: 2,
  coinstake: 3,
  comment: 204,
  boost: 208,
} as const

export const WALLET_HISTORY_TX_TYPES: readonly number[] = Object.values(TX_TYPE)

/** Адрес выхода (у OP_RETURN-выходов — пустой). */
function voutAddress(out: TxVout): string {
  return out.scriptPubKey?.addresses?.[0] || ''
}

/** Служебная метка перевода → смысл. */
function markerSemantic(text: string | undefined): WalletTxSemantic {
  if (text === DONATE_MARKER) return 'donate'
  if (text === SUBSCRIPTION_MARKER) return 'subscription'
  if (text === MONETIZATION_MARKER) return 'monetization'
  return null
}

const sum = (values: number[]): number => values.reduce((s, v) => s + v, 0)

/** Убрать хвост плавающей точки: 8 знаков, как у сатоши. */
const pkoin = (value: number): number => Math.round(value * 1e8) / 1e8

const NONE: ClassifiedWalletTx = {
  direction: 'change',
  amount: 0,
  counterparties: [],
  semantic: null,
}

export function classifyWalletTx(tx: Transaction, mine: ReadonlySet<string>): ClassifiedWalletTx {
  const vin = tx.vin || []
  const vout = tx.vout || []
  const isMine = (address: string | undefined): boolean => !!address && mine.has(address)
  const fromMe = vin.some((i) => isMine(i.address))
  const toMe = vout.filter((o) => isMine(voutAddress(o)))
  const toOthers = vout.filter((o) => voutAddress(o) && !isMine(voutAddress(o)))
  const unique = (addresses: string[]) =>
    Array.from(new Set(addresses.filter((a) => a && !isMine(a))))

  if (tx.type === TX_TYPE.coinstake) {
    // Свой блок: свои монеты вернулись с наградой. Выходы другим — лотерея.
    if (fromMe) {
      const reward = pkoin(
        sum(toMe.map((o) => o.value || 0)) -
          sum(vin.filter((i) => isMine(i.address)).map((i) => i.value || 0))
      )
      if (reward <= 0) return NONE
      return { direction: 'in', amount: reward, counterparties: [], semantic: 'stake' }
    }
    if (!toMe.length) return NONE
    return {
      direction: 'in',
      amount: pkoin(sum(toMe.map((o) => o.value || 0))),
      counterparties: [],
      semantic: 'lottery',
    }
  }

  if (tx.type === TX_TYPE.boost && fromMe && !toOthers.length) {
    // Сумма буста целиком уходит в комиссию: входы − выходы.
    const fee = pkoin(sum(vin.map((i) => i.value || 0)) - sum(vout.map((o) => o.value || 0)))
    if (fee <= 0) return NONE
    return { direction: 'out', amount: fee, counterparties: [], semantic: 'boost' }
  }

  let direction: WalletTxDirection = 'change'
  let valueouts: TxVout[] = []
  if (fromMe && toOthers.length) {
    direction = 'out'
    valueouts = toOthers
  } else if (!fromMe && toMe.length) {
    direction = 'in'
    valueouts = toMe
  }
  if (direction === 'change') return NONE

  const amount = pkoin(sum(valueouts.map((o) => o.value || 0)))
  if (amount <= 0) return NONE
  const counterparties =
    direction === 'in'
      ? unique(vin.map((i) => i.address || ''))
      : unique(valueouts.map(voutAddress))
  const semantic: WalletTxSemantic =
    tx.type === TX_TYPE.comment ? 'comment' : markerSemantic(txOpReturnText(vout))
  return { direction, amount, counterparties, semantic }
}
