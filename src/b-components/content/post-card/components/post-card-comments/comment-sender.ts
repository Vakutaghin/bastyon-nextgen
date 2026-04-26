// Отправка комментария через блокчейн-транзакцию

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { getUnspents, filterAvailableUnspents, selectBestUnspents, lockUTXOs } from '@/blockchain/core/transactions/unspents-manager'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import type { CommentMessagePayload, CommentMessageBody } from '@/types/rpc-requests/send-raw-transaction-with-message'

import { COMMENT_TX_FEE } from './consts'

/**
 * Формирует тело сообщения комментария (msg) в виде JSON-строки.
 */
function buildCommentMsgBody(message: string): string {
  const body: CommentMessageBody = {
    message: message.trim(),
    url: '',
    images: [],
    info: '',
  }
  return JSON.stringify(body)
}

/**
 * Отправка нового комментария или редактирование существующего.
 *
 * Для нового (editId не передан):
 *   - operationType = 'comment'
 *   - serializedData = postid + msg + parentid + answerid
 *   - payload = { postid, parentid, answerid, msg }
 *
 * Для редактирования (editId = txid редактируемого, по legacy proxy16/lib/kit.js:538-552):
 *   - operationType = 'commentEdit'
 *   - serializedData тот же
 *   - payload = { postid, parentid, answerid, msg, id: editId }
 *
 * @returns txid отправленной транзакции
 */
export async function sendComment(
  postId: string,
  parentId: string,
  answerId: string,
  messageText: string,
  editId?: string,
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error('Нужна авторизация для отправки комментария')
  if (!postId || !messageText.trim()) throw new Error('Пост и текст комментария обязательны')

  const msg = buildCommentMsgBody(messageText)
  const messagePayload: CommentMessagePayload = {
    postid: postId,
    answerid: answerId || '',
    parentid: parentId || '',
    msg,
  }
  if (editId) messagePayload.id = editId

  // Сериализация как в старом приложении: postid + msg + parentid + answerid
  const serializedData = postId + msg + (parentId || '') + (answerId || '')

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error('Нет доступных unspents')

  const selectedUnspents = selectBestUnspents(unspents, COMMENT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error('Не удалось выбрать unspents для транзакции')

  lockUTXOs(selectedUnspents)

  const operationType = editId ? 'commentEdit' : 'comment'

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType,
    fee: COMMENT_TX_FEE,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, messagePayload, operationType],
    options: { auth: true },
  })

  if (typeof response === 'string') return response
  if (response && typeof response === 'object' && 'data' in response && typeof (response as any).data === 'string') {
    return (response as any).data
  }
  if (response && typeof response === 'object' && 'result' in response && (response as any).result === 'success' && 'data' in response) {
    return (response as any).data
  }

  const err = response && typeof response === 'object' && 'error' in response ? (response as any).error : null
  throw err instanceof Error ? err : new Error(String(err ?? 'Ошибка отправки комментария'))
}
