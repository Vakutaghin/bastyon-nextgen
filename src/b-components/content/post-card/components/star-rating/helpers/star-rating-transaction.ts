// Построение и отправка upvoteShare-транзакции. Логика блокчейн-операции
// вынесена из composable'а — на вход адрес автора, share id и значение оценки.

import { Buffer } from 'buffer'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'

/** Сериализация полезной нагрузки для подписи transaction-builder. */
function serializeUpvoteData(shareId: string, value: number): string {
  return shareId + value.toString()
}

/**
 * Собирает и отправляет upvoteShare-транзакцию. Бросает осмысленное Error при отсутствии
 * аутентификации / UTXO или ошибке RPC. На успех возвращает txid.
 *
 * `contentAuthorAddress` идёт в OP_RETURN — нужен для агрегации reputation на стороне ноды.
 */
export async function sendUpvoteTransaction(
  shareId: string,
  value: number,
  contentAuthorAddress: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error('User not authenticated')
  if (!contentAuthorAddress) throw new Error('Content author address is required')

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents || unspents.length === 0) throw new Error('No unspents available')

  const selectedUnspents = selectBestUnspents(unspents, 0.00000001)
  if (selectedUnspents.length === 0)
    throw new Error('No suitable unspents available for transaction')

  lockUTXOs(selectedUnspents)

  const serializedData = serializeUpvoteData(shareId, value)
  const rpcData = { share: shareId, value: value.toString() }

  const payloadString = `${contentAuthorAddress} ${value}`
  const opReturnData = [Buffer.from(payloadString, 'utf8')]

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'upvoteShare',
    opReturnData,
    fee: 0.00000001,
  })

  return broadcastTransaction({
    hex: builtTx.hex,
    messageData: rpcData,
    operationType: 'upvoteShare',
  })
}
