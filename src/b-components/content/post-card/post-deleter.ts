// Удаление своего поста через блокчейн-транзакцию contentDelete.
//
// Формат 1:1 из legacy `Remove` (kit.js:4248-4342, alias contentDelete→Remove):
//   - operationType: 'contentDelete'
//   - serialize():   txidEdit (= txid удаляемого поста), без msg
//   - payload:       { txidEdit }
//
// Тот же механизм, что и проверенное удаление комментария (commentDelete) —
// см. post-card-comments/comment-deleter.ts.

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { t } from '@/i18n'

interface SendTxResponse {
  result?: string
  data?: unknown
  error?: unknown
}

/**
 * Удаляет пост пользователя (contentDelete). Возвращает txid транзакции.
 */
export async function deletePost(postId: string): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('postCard.deleteAuthRequired'))
  if (!postId) throw new Error(t('postCard.deleteFailed'))

  // serialize() у Remove = txidEdit (только txid поста); payload = { txidEdit }.
  const serializedData = postId
  const messagePayload = { txidEdit: postId }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('postCard.deleteFailed'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('postCard.deleteFailed'))

  lockUTXOs(selectedUnspents)

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'contentDelete',
    fee: DEFAULT_TX_FEE,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, messagePayload, 'contentDelete'],
    options: { auth: true },
  })

  if (typeof response === 'string') return response
  const res = response as SendTxResponse | null
  if (res && typeof res === 'object' && typeof res.data === 'string') return res.data
  if (res && typeof res === 'object' && res.result === 'success' && typeof res.data === 'string') {
    return res.data
  }
  const err = res && typeof res === 'object' ? res.error : null
  throw err instanceof Error ? err : new Error(String(err ?? t('postCard.deleteFailed')))
}
