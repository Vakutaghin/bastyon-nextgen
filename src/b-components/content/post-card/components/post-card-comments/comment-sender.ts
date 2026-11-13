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
import { pendingSnippet, type PendingMeta } from '@/blockchain/core/transactions/broadcast-events'
import { voteCommentBody } from '@/helpers/content/poll'
import { commentBodyFits } from './comment-payload'

/** Тело нового комментария: текст и адреса уже загруженных картинок. */
function newBody(message: string, images: readonly string[] = []): CommentMessageBody {
  return { message: message.trim(), url: '', images: [...images], info: '' }
}

/**
 * Тело правки: новый текст, а картинки, ссылка и `info` — из исходного `msg`:
 * правка только текстом стёрла бы картинки комментария.
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
  if (!editId) return sendNewComment(postId, parentId, answerId, messageText)
  if (!postId || !messageText.trim()) throw new Error(t('commentsMsg.errPostAndTextRequired'))
  // Правка — в общих «песочных часах».
  const pending: PendingMeta = { postId, title: pendingSnippet(messageText) }
  return sendCommentBody(
    postId,
    parentId,
    answerId,
    editedBody(originalMsg, messageText),
    pending,
    editId
  )
}

/**
 * Новый комментарий или ответ: текст и картинки (адреса уже загруженных —
 * use-comment-images). Комментарий из одних картинок допустим, как у прежнего
 * приложения (kit.js pComment.validation). Часы показывает comments-store,
 * а за блоком следит общий трекер.
 */
export function sendNewComment(
  postId: string,
  parentId: string,
  answerId: string,
  messageText: string,
  images: readonly string[] = []
): Promise<string> {
  if (!postId || (!messageText.trim() && images.length === 0)) {
    return Promise.reject(new Error(t('commentsMsg.errPostAndTextRequired')))
  }
  return sendCommentBody(postId, parentId, answerId, newBody(messageText, images), {
    kind: 'comment',
    postId,
  })
}

/**
 * Голос в опросе поста — корневой комментарий с номером варианта в `info`
 * (формат — helpers/content/poll.ts).
 */
export function sendPollVote(postId: string, index: number, option: string): Promise<string> {
  return sendCommentBody(postId, '', '', voteCommentBody(index, option), {
    kind: 'pollVote',
    postId,
    title: pendingSnippet(option),
  })
}

/** Комментарий с готовым телом: транзакция `comment` или `commentEdit`. */
async function sendCommentBody(
  postId: string,
  parentId: string,
  answerId: string,
  body: CommentMessageBody,
  pending: PendingMeta | false,
  editId?: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('commentsMsg.errAuthRequiredSend'))
  // Сеть такую транзакцию отклонит — не тратим на неё монеты и время.
  if (!commentBodyFits(body)) {
    throw new Error(t(body.images.length ? 'commentsMsg.tooLongWithImages' : 'commentsMsg.tooLong'))
  }

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
    pending,
  })
}
