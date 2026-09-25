/**
 * Сборка транзакции перевода PKOIN (только выходы на адреса, без контентного
 * OP_RETURN). Для отправки используйте sendTransactionWithMessage с
 * operationType 'transaction'.
 */

// Buffer polyfill для браузера (side-effect: устанавливает globalThis.Buffer)
import { Buffer } from '../../utils/buffer-polyfill'
import type { KeyPair } from '../../types/keys'
import type { UTXO } from '@/composables/use-wallet-queries'
import { POCKETNET_NETWORK } from '../../constants/network'
import { AMOUNT_MULTIPLIER, toSatoshis, DUST_VALUE } from '../../constants/transactions'
import { loadPocketnetBitcoin, getTransactionBuilder } from './btc17-loader'

/** Параметры для сборки транзакции перевода PKOIN */
export interface BuildTransferTransactionParams {
  unspents: UTXO[]
  /** Адрес для сдачи (change) */
  fromAddress: string
  /** Список адресов-источников (для messageData) */
  sourceAddresses: string[]
  keyPair: KeyPair
  /** Выходы: адрес получателя и сумма в PKOIN */
  outputs: Array<{ address: string; amount: number }>
  /** Комиссия в PKOIN */
  fee?: number
  /** Сообщение (опционально) */
  message?: string
  /** Режим комиссии: include = получатель платит, exclude = отправитель платит */
  feemode?: 'include' | 'exclude'
}

/** Результат сборки транзакции перевода */
export interface BuiltTransferTransaction {
  hex: string
  totalInputAmount: number
  totalOutputAmount: number
  /**
   * Комиссия, которую реально заберёт сеть, в сатоши: заявленная плюс сдача,
   * не дотянувшая до dust (её нельзя оформить выходом, и она уходит майнеру).
   * UI показывал заявленный 1 сатоши и молчал про сожжённые до 700 (N1).
   */
  feePaidSatoshis: number
  /** Сколько из комиссии — это сгоревшая сдача (0, если сдача вышла выходом). */
  burnedChangeSatoshis: number
  usedUnspents: UTXO[]
  outputs: Array<{ address: string; amount: number }>
  /** Данные для sendrawtransactionwithmessage (второй параметр) */
  messageData: Record<string, unknown>
}

/**
 * Собирает транзакцию перевода PKOIN (только выходы на адреса, без контентного OP_RETURN).
 * Для отправки используйте sendTransactionWithMessage с operationType 'transaction'.
 */
export async function buildTransferTransaction(
  params: BuildTransferTransactionParams
): Promise<BuiltTransferTransaction> {
  // Убеждаемся, что библиотека загружена (бросает при ошибке загрузки).
  await loadPocketnetBitcoin()

  const TransactionBuilder = getTransactionBuilder()
  const {
    unspents,
    fromAddress,
    sourceAddresses: sourceAddressesParam,
    keyPair,
    outputs,
    fee = 1 / AMOUNT_MULTIPLIER,
    message = '',
    feemode = 'include',
  } = params

  if (!unspents?.length) {
    throw new Error('No unspents provided')
  }

  if (!keyPair?.ecPair) {
    throw new Error('Valid key pair is required')
  }

  const totalInputAmount = unspents.reduce((sum, u) => sum + u.amount, 0)
  const totalInputSatoshis = toSatoshis(totalInputAmount)
  const feeSatoshis = toSatoshis(fee)

  const outputsAmount = outputs.reduce((s, o) => s + o.amount, 0)
  const outputsSatoshis = outputs.reduce((s, o) => s + toSatoshis(o.amount), 0)
  const changeAmountSatoshis = totalInputSatoshis - outputsSatoshis - feeSatoshis

  if (changeAmountSatoshis < 0) {
    throw new Error('Insufficient funds for the transfer, taking into account the commission')
  }

  // Сдача меньше dust не может стать выходом — она достаётся сети как часть
  // комиссии. Считаем это честно и отдаём наружу (N1).
  const finalChangeAmount =
    changeAmountSatoshis >= toSatoshis(DUST_VALUE) ? changeAmountSatoshis : 0
  const burnedChangeSatoshis = finalChangeAmount === 0 ? changeAmountSatoshis : 0
  const feePaidSatoshis = feeSatoshis + burnedChangeSatoshis

  const txb = new TransactionBuilder(POCKETNET_NETWORK)
  txb.addNTime(0)

  unspents.forEach((unspent) => {
    if (!unspent.scriptPubKey) {
      throw new Error(`Missing scriptPubKey for unspent ${unspent.txid}:${unspent.vout}`)
    }
    txb.addInput(unspent.txid, unspent.vout, null, Buffer.from(unspent.scriptPubKey, 'hex'))
  })

  // Выходы: сначала получатели, потом сдача
  outputs.forEach((out) => {
    txb.addOutput(out.address, toSatoshis(out.amount))
  })

  if (finalChangeAmount > 0) {
    txb.addOutput(fromAddress, finalChangeAmount)
  }

  // Объектная форма, как в build-content-transaction: позиционная
  // txb.sign(index, keyPair) печатала DEPRECATED на каждый вход перевода (N3).
  // Входы — только p2pkh основного адреса: трата с Z-адресов не поддерживается
  // (Р2), и чужой тип входа теперь даёт внятную ошибку вместо невнятной.
  unspents.forEach((_unspent, index) => {
    txb.sign({ prevOutScriptType: 'p2pkh', vin: index, keyPair: keyPair.ecPair })
  })

  const tx = txb.build()
  const hex = tx.toHex()

  const derivedSources = [
    ...new Set(unspents.map((u) => u.address).filter((a): a is string => Boolean(a))),
  ]
  const sourceList =
    sourceAddressesParam?.length > 0
      ? sourceAddressesParam
      : derivedSources.length
        ? derivedSources
        : [fromAddress]

  const messageData: Record<string, unknown> = {
    source: { v: sourceList },
    reciever: { v: outputs },
    message: { v: message },
    feemode: { v: feemode },
  }

  return {
    hex,
    totalInputAmount,
    totalOutputAmount: outputsAmount,
    feePaidSatoshis,
    burnedChangeSatoshis,
    usedUnspents: unspents,
    outputs,
    messageData,
  }
}
