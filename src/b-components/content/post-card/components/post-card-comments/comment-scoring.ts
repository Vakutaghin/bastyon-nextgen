// Отправка лайка/дизлайка комментария (cScore) через блокчейн-транзакцию

import { Buffer } from 'buffer'

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import { getUnspents, filterAvailableUnspents, selectBestUnspents, lockUTXOs } from '@/blockchain/core/transactions/unspents-manager'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { t } from '@/i18n'

import { COMMENT_TX_FEE } from './consts'

/**
 * Извлекает txid из ответа RPC (поддержка нескольких форматов обёрток).
 */
function extractTxidFromResponse(response: any): string {
  if (typeof response === 'string') return response

  if (response && typeof response === 'object' && 'data' in response && typeof response.data === 'string') {
    return response.data
  }
  if (response && typeof response === 'object' && 'result' in response && response.result === 'success' && 'data' in response) {
    return response.data
  }

  const err = response && typeof response === 'object' && 'error' in response ? response.error : null
  throw err instanceof Error ? err : new Error(String(err ?? t('commentsMsg.errTxFailed')))
}

/**
 * Подготавливает unspents для транзакции.
 */
async function prepareUnspents(address: string) {
  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('commentsMsg.errNoUnspents'))

  const selected = selectBestUnspents(unspents, COMMENT_TX_FEE)
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
  commentAuthorAddress: string,
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
    fee: COMMENT_TX_FEE,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, rpcData, 'cScore'],
    options: { auth: true },
  })

  return extractTxidFromResponse(response)
}
