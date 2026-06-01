// Блокировка / разблокировка пользователя через блокчейн-транзакции
// `blocking` / `unblocking`.
//
// Формат payload и serialize взяты 1:1 из legacy proxy16/lib/kit.js:145-239:
//   - operationType: 'blocking' | 'unblocking'
//   - serialize():   просто адрес блокируемого пользователя
//   - export()/payload: { address: <адрес> }
//
// Это самостоятельная on-chain операция отношений между пользователями
// (не привязана к комментариям) — отсюда расположение в core/actions.

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { t } from '@/i18n'

/** Комиссия транзакции отношений (1 сатоши, как у комментариев). */
const RELATION_TX_FEE = 0.00000001

/** Минимальная форма ответа sendrawtransactionwithmessage: txid-строка либо конверт. */
interface SendTxResponse {
  result?: string
  data?: unknown
  error?: unknown
}

type RelationOperation = 'blocking' | 'unblocking'

/** Тело сообщения для blocking/unblocking — только адрес цели (legacy export()). */
interface RelationMessagePayload {
  address: string
}

async function sendRelationTx(
  targetAddress: string,
  operationType: RelationOperation
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('commentsMsg.errAuthRequiredBlock'))
  if (!targetAddress) throw new Error(t('commentsMsg.errAuthorAddressRequired'))
  if (targetAddress === address) throw new Error(t('commentsMsg.errBlockSelf'))

  const messagePayload: RelationMessagePayload = { address: targetAddress }

  // serialize() в legacy для blocking/unblocking возвращает просто адрес.
  const serializedData = targetAddress

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('commentsMsg.errNoUnspents'))

  const selectedUnspents = selectBestUnspents(unspents, RELATION_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('commentsMsg.errSelectUnspents'))

  lockUTXOs(selectedUnspents)

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType,
    fee: RELATION_TX_FEE,
  })

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, messagePayload, operationType],
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
  throw err instanceof Error ? err : new Error(String(err ?? t('commentsMsg.errTxFailed')))
}

/** Заблокировать пользователя. Возвращает txid отправленной транзакции. */
export function blockUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'blocking')
}

/** Разблокировать пользователя. Возвращает txid отправленной транзакции. */
export function unblockUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'unblocking')
}
