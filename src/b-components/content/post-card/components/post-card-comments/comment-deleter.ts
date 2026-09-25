// Удаление комментария через блокчейн-транзакцию commentDelete.
//
// Формат payload и serializedData взяты 1:1 из legacy: proxy16/lib/kit.js:457-504, 538-552
//   - operationType: 'commentDelete'
//   - serialized:    postid + (parentid || '') + (answerid || '')   (msg отсутствует)
//   - payload:       { postid, answerid, parentid, id: txidЕдалённогоКомментария }

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { t } from '@/i18n'
import type { CommentMessagePayload } from '@/types/rpc-requests/send-raw-transaction-with-message'

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'

export interface DeleteCommentParams {
  /** txid поста, к которому относится комментарий */
  postId: string
  /** txid удаляемого комментария */
  commentId: string
  /** txid комментария, на который было отвечено (если ответ на ответ) */
  answerId?: string
  /** txid корневого (первого) комментария ветки (если ответ) */
  parentId?: string
}

/**
 * Удаляет комментарий пользователя.
 * Возвращает txid отправленной транзакции.
 */
export async function deleteComment(params: DeleteCommentParams): Promise<string> {
  const { postId, commentId } = params
  const answerId = params.answerId || ''
  const parentId = params.parentId || ''

  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('commentsMsg.errAuthRequiredDelete'))
  if (!postId || !commentId) throw new Error(t('commentsMsg.errPostAndCommentRequired'))

  const messagePayload: CommentMessagePayload = {
    postid: postId,
    answerid: answerId,
    parentid: parentId,
    id: commentId,
  }

  // serializedData как в legacy serialize(): postid + parentid + answerid (без msg при delete)
  const serializedData = postId + parentId + answerId

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('commentsMsg.errNoUnspents'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('commentsMsg.errSelectUnspents'))

  lockUTXOs(selectedUnspents)

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'commentDelete',
    fee: DEFAULT_TX_FEE,
  })

  return broadcastTransaction({
    hex: builtTx.hex,
    messageData: messagePayload,
    operationType: 'commentDelete',
  })
}
