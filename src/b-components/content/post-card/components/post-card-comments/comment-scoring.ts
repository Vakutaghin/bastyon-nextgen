// Отправка лайка/дизлайка комментария (cScore) через блокчейн-транзакцию

import { Buffer } from 'buffer'

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { t } from '@/i18n'

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'

/**
 * Подготавливает unspents для транзакции.
 */
async function prepareUnspents(address: string) {
  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('commentsMsg.errNoUnspents'))

  const selected = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selected.length === 0) throw new Error(t('commentsMsg.errSelectUnspents'))

  lockUTXOs(selected)
  return selected
}

/**
 * Отправка лайка/дизлайка комментария (cScore).
 * Строит транзакцию с serializedData = commentId + value,
 * opreturn = commentAuthorAddress + " " + value.
 *
 * @param commentId - ID комментария
 * @param value - 1 (лайк) или -1 (дизлайк)
 * @param commentAuthorAddress - адрес автора комментария
 * @returns txid отправленной транзакции
 */
export async function sendCommentScore(
  commentId: string,
  value: 1 | -1,
  commentAuthorAddress: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('commentsMsg.errAuthRequiredScore'))
  if (!commentAuthorAddress) throw new Error(t('commentsMsg.errAuthorAddressRequired'))

  const selectedUnspents = await prepareUnspents(address)

  const serializedData = commentId + value.toString()
  const payloadString = `${commentAuthorAddress} ${value}`
  const opReturnData = [Buffer.from(payloadString, 'utf8')]
  const rpcData = { commentid: commentId, value: value.toString() }

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'cScore',
    opReturnData,
    fee: DEFAULT_TX_FEE,
  })

  return broadcastTransaction({ hex: builtTx.hex, messageData: rpcData, operationType: 'cScore' })
}
