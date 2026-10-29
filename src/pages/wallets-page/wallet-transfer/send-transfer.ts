// Vue-free путь отправки PKOIN со вкладки «Перевод»: unspents → выбор и лок
// входов → сборка transfer-транзакции → отправка. Вынесено из
// wallet-transfer.vue, чтобы tx-путь был юнит-тестируемым: адрес и ключи
// приходят аргументами, а не из стора; i18n остаётся в компоненте.
import type { KeyPair } from '@/blockchain/types/keys'
import { transferFee } from '@/blockchain/core/transactions/transfer-fee'
import { utf8Length } from '@/helpers/common/op-return'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
  unlockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { buildTransferTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { sendTransactionWithMessage } from '@/blockchain/core/transactions/transaction-sender'

export type FeeMode = 'include' | 'exclude'

/** Не хватает UTXO на сумму (+ комиссию при exclude). Компонент переводит в i18n. */
export class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient funds')
    this.name = 'InsufficientFundsError'
  }
}

export interface SendTransferParams {
  fromAddress: string
  keyPair: KeyPair
  toAddress: string
  /** Сумма, которую ввёл пользователь (PKOIN). */
  amount: number
  feemode: FeeMode
  message?: string
  fee?: number
}

/**
 * Что получит адресат и сколько нужно набрать входами.
 * include = получатель платит: комиссия вычитается из суммы перевода.
 * exclude = отправитель платит: ищем (сумма + комиссия) в UTXO.
 */
export function computeTransferAmounts(
  amount: number,
  feemode: FeeMode,
  fee: number
): { receiverAmount: number; requiredAmount: number } {
  return {
    receiverAmount: feemode === 'include' ? Math.max(0, amount - fee) : amount,
    requiredAmount: feemode === 'exclude' ? amount + fee : amount,
  }
}

/** Зависимости, подменяемые в тестах (по умолчанию — реальные модули). */
export interface SendTransferDeps {
  getUnspents: typeof getUnspents
  filterAvailableUnspents: typeof filterAvailableUnspents
  selectAndLockUnspents: typeof selectAndLockUnspents
  unlockUTXOs: typeof unlockUTXOs
  buildTransferTransaction: typeof buildTransferTransaction
  sendTransactionWithMessage: typeof sendTransactionWithMessage
}

const defaultDeps: SendTransferDeps = {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
  unlockUTXOs,
  buildTransferTransaction,
  sendTransactionWithMessage,
}

/**
 * Отправляет перевод и возвращает txid с фактической комиссией. Бросает
 * InsufficientFundsError, если входов не хватает; остальные ошибки
 * (сборка/сеть) пробрасываются как есть.
 */
export interface SendTransferResult {
  txid: string
  /** Сколько реально забрала сеть, в сатоши (с учётом сгоревшей сдачи, N1). */
  feePaidSatoshis: number
}

export async function sendTransfer(
  params: SendTransferParams,
  deps: SendTransferDeps = defaultDeps
): Promise<SendTransferResult> {
  const messageBytes = utf8Length((params.message || '').trim())
  let unspents = await deps.getUnspents(params.fromAddress, 1, 9999999)
  unspents = deps.filterAvailableUnspents(unspents, false)

  // Комиссия зависит от размера, размер — от числа входов, а число входов —
  // от суммы с комиссией. Поэтому входы берём по оценке на один вход, затем
  // пересчитываем комиссию по тому, сколько входов набралось, и если их
  // перестало хватать — набираем заново уже под новую сумму. Прежний набор
  // при этом отпускаем: иначе его входы минуту не видел бы следующий перевод.
  let fee = params.fee ?? transferFee({ inputs: 1, outputs: 1, messageBytes })
  let selected = deps.selectAndLockUnspents(
    unspents,
    computeTransferAmounts(params.amount, params.feemode, fee).requiredAmount
  ) // лок входов (P2-5/S6)
  if (!selected.length) throw new InsufficientFundsError()

  for (let pass = 0; params.fee === undefined && pass < 3; pass++) {
    const byShape = transferFee({ inputs: selected.length, outputs: 1, messageBytes })
    if (byShape <= fee) break
    fee = byShape
    const required = computeTransferAmounts(params.amount, params.feemode, fee).requiredAmount
    const total = selected.reduce((sum, u) => sum + u.amount, 0)
    if (total + 1e-9 >= required) break
    deps.unlockUTXOs(selected)
    selected = deps.selectAndLockUnspents(unspents, required)
    if (!selected.length) throw new InsufficientFundsError()
  }

  const { receiverAmount } = computeTransferAmounts(params.amount, params.feemode, fee)

  const built = await deps.buildTransferTransaction({
    unspents: selected,
    fromAddress: params.fromAddress,
    sourceAddresses: [params.fromAddress],
    keyPair: params.keyPair,
    outputs: [{ address: params.toAddress, amount: receiverAmount }],
    fee,
    message: (params.message || '').trim(),
    feemode: params.feemode,
  })

  const txid = await deps.sendTransactionWithMessage({
    hex: built.hex,
    messageData: built.messageData,
    operationType: 'transaction',
    pending: { address: params.toAddress, amount: params.amount },
  })

  return { txid, feePaidSatoshis: built.feePaidSatoshis }
}
