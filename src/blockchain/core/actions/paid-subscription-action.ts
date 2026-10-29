// Оплата платной подписки на автора.
//
// Как у старого клиента (components/getpaidsubscription): обычный перевод PKOIN
// автору с меткой `a:subscription` в OP_RETURN, комиссию платит подписчик
// (feemode exclude) — автору приходит ровно цена срока. По метке нода находит
// платежи (getfromtotransactions), а клиенты по ним решают, оплачена ли подписка.
// OP_RETURN — первый выход, получатель — второй: нода берёт сумму именно оттуда.

import { useAuthStore } from '@/blockchain'
import { SUBSCRIPTION_MARKER } from '@/helpers/common/op-return'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
} from '../transactions/unspents-manager'
import { buildTransferTransaction } from '../transactions/transaction-builder'
import { sendTransactionWithMessage } from '../transactions/transaction-sender'
import { AMOUNT_MULTIPLIER } from '../../constants/transactions'
import { transferFee } from '../transactions/transfer-fee'
import { utf8Length } from '@/helpers/common/op-return'
import { t } from '@/i18n'

/** Платит автору `amount` сатоши за подписку. Возвращает txid. */
export async function payForSubscription(authorAddress: string, amount: number): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('paidSubscriptions.errAuthRequired'))
  if (!authorAddress || authorAddress === address) throw new Error(t('paidSubscriptions.errSelf'))
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(t('paidSubscriptions.errAmount'))

  const pkoin = amount / AMOUNT_MULTIPLIER
  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  // exclude: комиссия сверху суммы, автору — ровно `amount`.
  // Комиссия от размера: денежный перевод с одним сатоши сеть не принимает.
  const messageBytes = utf8Length(SUBSCRIPTION_MARKER)
  const selected = selectAndLockUnspents(
    unspents,
    pkoin + transferFee({ inputs: 1, outputs: 1, messageBytes })
  ) // лок входов (S6)
  if (!selected.length) throw new Error(t('paidSubscriptions.errInsufficient'))

  const built = await buildTransferTransaction({
    unspents: selected,
    fromAddress: address,
    sourceAddresses: [address],
    keyPair,
    outputs: [{ address: authorAddress, amount: pkoin }],
    fee: transferFee({ inputs: selected.length, outputs: 1, messageBytes }),
    message: SUBSCRIPTION_MARKER,
    feemode: 'exclude',
  })

  return sendTransactionWithMessage({
    hex: built.hex,
    messageData: built.messageData,
    operationType: 'transaction',
    pending: { kind: 'paidSubscription', address: authorAddress, amount: pkoin },
  })
}
