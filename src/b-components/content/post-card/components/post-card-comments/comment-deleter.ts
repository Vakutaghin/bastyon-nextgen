// Удаление комментария через блокчейн-транзакцию commentDelete.
//
// Формат payload и serializedData взяты 1:1 из legacy: proxy16/lib/kit.js:457-504, 538-552
//   - operationType: 'commentDelete'
//   - serialized:    postid + (parentid || '') + (answerid || '')   (msg отсутствует)
//   - payload:       { postid, answerid, parentid, id: txidЕдалённогоКомментария }

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { getUnspents, filterAvailableUnspents, selectBestUnspents, lockUTXOs } from '@/blockchain/core/transactions/unspents-manager'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { t } from '@/i18n'
import type { CommentMessagePayload } from '@/types/rpc-requests/send-raw-transaction-with-message'

import { COMMENT_TX_FEE } from './consts'

/** Минимальная форма ответа sendrawtransactionwithmessage: либо txid-строка, либо конверт. */
interface SendTxResponse {
  result?: string
  data?: unknown
  error?: unknown
}

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

  const selectedUnspents = selectBestUnspents(unspents, COMMENT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('commentsMsg.errSelectUnspents'))

  lockUTXOs(selectedUnspents)

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'commentDelete',
    fee: COMMENT_TX_FEE,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, messagePayload, 'commentDelete'],
    options: { auth: true },
  })

  if (typeof response === 'string') return response
  const res = response as SendTxResponse | null
  if (res && typeof res === 'object' && typeof res.data === 'string') {
    return res.data
  }
  if (res && typeof res === 'object' && res.result === 'success' && typeof res.data === 'string') {
    return res.data
  }

  const err = res && typeof res === 'object' ? res.error : null
  throw err instanceof Error ? err : new Error(String(err ?? t('commentsMsg.errDeleteFailed')))
}
