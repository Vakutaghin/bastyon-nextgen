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
  selectAndLockUnspents,
} from '../transactions/unspents-manager'
import { buildTransferTransaction } from '../transactions/transaction-builder'
import { sendTransactionWithMessage } from '../transactions/transaction-sender'
import { transferFee } from '../transactions/transfer-fee'
import { utf8Length } from '@/helpers/common/op-return'
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
  // Комиссия считается от размера транзакции: денежный перевод с одним
  // сатоши сеть отклоняет (-26). Для проверки «сумма не меньше комиссии»
  // берём оценку по одному входу, точную — после выбора входов.
  const messageBytes = utf8Length(DONATE_MESSAGE)
  if (!Number.isFinite(amount) || amount <= transferFee({ inputs: 1, outputs: 1, messageBytes })) {
    throw new Error(t('donate.errAmountTooSmall'))
  }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectAndLockUnspents(unspents, amount) // лок входов (S6)
  if (!selected.length) throw new Error(t('donate.errInsufficient'))

  const fee = transferFee({ inputs: selected.length, outputs: 1, messageBytes })
  // include: комиссия вычитается из суммы перевода (получатель получает amount - fee).
  const receiverAmount = Math.max(0, amount - fee)

  const built = await buildTransferTransaction({
    unspents: selected,
    fromAddress: address,
    sourceAddresses: [address],
    keyPair,
    outputs: [{ address: authorAddress, amount: receiverAmount }],
    fee,
    message: DONATE_MESSAGE,
    feemode: 'include',
  })

  return sendTransactionWithMessage({
    hex: built.hex,
    messageData: built.messageData,
    operationType: 'transaction',
    pending: { kind: 'donate', address: authorAddress, amount },
  })
}
