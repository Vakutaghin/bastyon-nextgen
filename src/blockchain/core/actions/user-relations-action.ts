// On-chain операции отношений между пользователями: блокировка/разблокировка
// (`blocking` / `unblocking`) и подписка/отписка (`subscribe` / `unsubscribe` /
// `subscribePrivate`).
//
// Формат payload и serialize взяты 1:1 из legacy kit.js:
//   - blocking/unblocking:  export() = { address }                  (kit.js:170-182, 219-231)
//   - subscribe:            export() = { address }                  (kit.js:71-83)
//   - subscribePrivate:     export() = { address }                  (kit.js:21-34)
//   - unsubscribe:          export() = { type: 'unsubscribe', address } (kit.js:120-133)
//   - serialize() во всех случаях возвращает просто адрес цели.
//
// RPC-вызов 1:1 с legacy actions.js:800-808 — parameters = [hex, export(), optype].
// Это самостоятельные on-chain операции (не привязаны к комментариям) — отсюда
// расположение в core/actions.

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

type RelationOperation =
  | 'blocking'
  | 'unblocking'
  | 'subscribe'
  | 'unsubscribe'
  | 'subscribePrivate'

/** i18n-ключи ошибок, специфичные для конкретной операции. */
interface RelationErrorKeys {
  /** Нет ключа/адреса (не авторизован). */
  authRequired: string
  /** Попытка применить операцию к самому себе. */
  self: string
}

/**
 * Тело сообщения (2-й параметр sendrawtransactionwithmessage) — legacy export().
 * Для `unsubscribe` legacy добавляет поле `type` (kit.js:129-132); у остальных
 * операций это просто `{ address }`.
 */
function buildMessagePayload(
  operationType: RelationOperation,
  targetAddress: string
): Record<string, string> {
  if (operationType === 'unsubscribe') {
    return { type: 'unsubscribe', address: targetAddress }
  }
  return { address: targetAddress }
}

async function sendRelationTx(
  targetAddress: string,
  operationType: RelationOperation,
  errorKeys: RelationErrorKeys
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t(errorKeys.authRequired))
  if (!targetAddress) throw new Error(t('commentsMsg.errAuthorAddressRequired'))
  if (targetAddress === address) throw new Error(t(errorKeys.self))

  const messagePayload = buildMessagePayload(operationType, targetAddress)

  // serialize() в legacy для всех этих операций возвращает просто адрес цели.
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

/** Ключи ошибок для block/unblock (legacy формулировки про блокировку). */
const BLOCK_ERROR_KEYS: RelationErrorKeys = {
  authRequired: 'commentsMsg.errAuthRequiredBlock',
  self: 'commentsMsg.errBlockSelf',
}

/** Ключи ошибок для subscribe/unsubscribe/subscribePrivate. */
const SUBSCRIBE_ERROR_KEYS: RelationErrorKeys = {
  authRequired: 'subscriptions.errAuthRequired',
  self: 'subscriptions.errSubscribeSelf',
}

/** Заблокировать пользователя. Возвращает txid отправленной транзакции. */
export function blockUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'blocking', BLOCK_ERROR_KEYS)
}

/** Разблокировать пользователя. Возвращает txid отправленной транзакции. */
export function unblockUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'unblocking', BLOCK_ERROR_KEYS)
}

/** Подписаться на пользователя (публичная подписка). Возвращает txid. */
export function subscribeUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'subscribe', SUBSCRIBE_ERROR_KEYS)
}

/**
 * Подписаться приватно (с уведомлениями). В legacy `subscribePrivate` коллизирует
 * с `subscribe`/`unsubscribe` по тому же адресу — нода хранит последнюю операцию.
 * Возвращает txid.
 */
export function subscribeUserPrivate(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'subscribePrivate', SUBSCRIBE_ERROR_KEYS)
}

/** Отписаться от пользователя. Возвращает txid. */
export function unsubscribeUser(targetAddress: string): Promise<string> {
  return sendRelationTx(targetAddress, 'unsubscribe', SUBSCRIBE_ERROR_KEYS)
}
