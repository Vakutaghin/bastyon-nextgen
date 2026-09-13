// Vue-free путь отправки PKOIN со вкладки «Перевод»: unspents → выбор и лок
// входов → сборка transfer-транзакции → отправка. Вынесено из
// wallet-transfer.vue, чтобы tx-путь был юнит-тестируемым: адрес и ключи
// приходят аргументами, а не из стора; i18n остаётся в компоненте.
import type { KeyPair } from '@/blockchain/types/keys'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
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
  fee: number = DEFAULT_TX_FEE
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
  buildTransferTransaction: typeof buildTransferTransaction
  sendTransactionWithMessage: typeof sendTransactionWithMessage
}

const defaultDeps: SendTransferDeps = {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
  buildTransferTransaction,
  sendTransactionWithMessage,
}

/**
 * Отправляет перевод и возвращает txid. Бросает InsufficientFundsError, если
 * входов не хватает; остальные ошибки (сборка/сеть) пробрасываются как есть.
 */
export async function sendTransfer(
  params: SendTransferParams,
  deps: SendTransferDeps = defaultDeps
): Promise<string> {
  const fee = params.fee ?? DEFAULT_TX_FEE
  let unspents = await deps.getUnspents(params.fromAddress, 1, 9999999)
  unspents = deps.filterAvailableUnspents(unspents, false)
  const { receiverAmount, requiredAmount } = computeTransferAmounts(
    params.amount,
    params.feemode,
    fee
  )
  const selected = deps.selectAndLockUnspents(unspents, requiredAmount) // лок входов (P2-5/S6)
  if (!selected.length) throw new InsufficientFundsError()

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

  return deps.sendTransactionWithMessage({
    hex: built.hex,
    messageData: built.messageData,
    operationType: 'transaction',
  })
}
