// Отправка комментария через блокчейн-транзакцию

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { t } from '@/i18n'
import type {
  CommentMessagePayload,
  CommentMessageBody,
} from '@/types/rpc-requests/send-raw-transaction-with-message'

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'
import { voteCommentBody } from '@/helpers/content/poll'

/** Тело обычного комментария: только текст. */
function textBody(message: string): CommentMessageBody {
  return { message: message.trim(), url: '', images: [], info: '' }
}

/**
 * Тело правки: новый текст, а картинки, ссылка и `info` — из исходного `msg`.
 * Новый клиент картинки к комментариям не прикладывает, но у комментариев из
 * старого приложения они бывают, и правка только текстом стёрла бы их.
 */
export function editedBody(originalMsg: string | undefined, message: string): CommentMessageBody {
  let original: Partial<Record<keyof CommentMessageBody, unknown>> = {}
  try {
    const parsed: unknown = JSON.parse(originalMsg ?? '')
    if (parsed && typeof parsed === 'object') original = parsed as typeof original
  } catch {
    // Старый формат: msg — просто текст, сохранять нечего.
  }
  return {
    message: message.trim(),
    url: typeof original.url === 'string' ? original.url : '',
    images: Array.isArray(original.images)
      ? original.images.filter((i): i is string => typeof i === 'string')
      : [],
    info: typeof original.info === 'string' ? original.info : '',
  }
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
 *   - `originalMsg` — msg редактируемого комментария: из него переносятся
 *     картинки, ссылка и info (см. editedBody)
 *
 * @returns txid отправленной транзакции
 */
export async function sendComment(
  postId: string,
  parentId: string,
  answerId: string,
  messageText: string,
  editId?: string,
  originalMsg?: string
): Promise<string> {
  if (!postId || !messageText.trim()) throw new Error(t('commentsMsg.errPostAndTextRequired'))
  const body = editId ? editedBody(originalMsg, messageText) : textBody(messageText)
  return sendCommentBody(postId, parentId, answerId, body, editId)
}

/**
 * Голос в опросе поста — корневой комментарий с номером варианта в `info`
 * (формат — helpers/content/poll.ts).
 */
export function sendPollVote(postId: string, index: number, option: string): Promise<string> {
  return sendCommentBody(postId, '', '', voteCommentBody(index, option))
}

/** Комментарий с готовым телом: транзакция `comment` или `commentEdit`. */
async function sendCommentBody(
  postId: string,
  parentId: string,
  answerId: string,
  body: CommentMessageBody,
  editId?: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('commentsMsg.errAuthRequiredSend'))

  const msg = JSON.stringify(body)
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
  if (!unspents?.length) throw new Error(t('commentsMsg.errNoUnspents'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('commentsMsg.errSelectUnspents'))

  lockUTXOs(selectedUnspents)

  const operationType = editId ? 'commentEdit' : 'comment'

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType,
    fee: DEFAULT_TX_FEE,
  })

  return broadcastTransaction({
    hex: builtTx.hex,
    messageData: messagePayload,
    operationType: operationType,
  })
}
