// Чаевые/донат автору поста или комментария.
//
// Механика 1:1 с legacy `components/donate/index.js`: это ОБЫЧНЫЙ перевод PKOIN
// на адрес автора (operationType 'transaction'), отличающийся только маркером в
// message — строкой `'a:donate'`. По ней нода атрибутирует транзакцию как чаевые
// (tip-уведомление + вес доната у контента), а не как обычный перевод.
//
// feemode 'include' (комиссию платит получатель) — тоже как в legacy donate.

import { useAuthStore } from '@/blockchain'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
} from '../transactions/unspents-manager'
import { buildTransferTransaction } from '../transactions/transaction-builder'
import { sendTransactionWithMessage } from '../transactions/transaction-sender'
import { DEFAULT_TX_FEE } from '../../constants/transactions'
import { t } from '@/i18n'

/** Маркер чаевых в message перевода (legacy donate/index.js:29). */
const DONATE_MESSAGE = 'a:donate'

/**
 * Отправляет донат `amount` PKOIN автору `authorAddress`. Возвращает txid.
 * `amount` — это валовая сумма, которую тратит донатер; получатель получит
 * `amount - комиссия` (feemode include).
 */
export async function donateToAuthor(authorAddress: string, amount: number): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('donate.errAuthRequired'))
  if (!authorAddress) throw new Error(t('donate.errNoRecipient'))
  if (authorAddress === address) throw new Error(t('donate.errSelf'))
  if (!Number.isFinite(amount) || amount <= DEFAULT_TX_FEE) {
    throw new Error(t('donate.errAmountTooSmall'))
  }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectBestUnspents(unspents, amount)
  if (!selected.length) throw new Error(t('donate.errInsufficient'))

  // include: комиссия вычитается из суммы перевода (получатель получает amount - fee).
  const receiverAmount = Math.max(0, amount - DEFAULT_TX_FEE)

  const built = await buildTransferTransaction({
    unspents: selected,
    fromAddress: address,
    sourceAddresses: [address],
    keyPair,
    outputs: [{ address: authorAddress, amount: receiverAmount }],
    fee: DEFAULT_TX_FEE,
    message: DONATE_MESSAGE,
    feemode: 'include',
  })

  return sendTransactionWithMessage({
    hex: built.hex,
    messageData: built.messageData,
    operationType: 'transaction',
  })
}
