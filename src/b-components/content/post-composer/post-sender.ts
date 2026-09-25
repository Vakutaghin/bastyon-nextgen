// Публикация поста (Share) через блокчейн-транзакцию.
// Построено по образцу comment-sender.ts: serialize + export + buildTransaction + RPC.

import { useAuthStore } from '@/blockchain'
import {
  exportPost,
  resolvePostOperationType,
  serializePost,
  type SharePostData,
} from '@/blockchain/core/actions/post-action'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  filterAvailableUnspents,
  getUnspents,
  lockUTXOs,
  selectBestUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { t } from '@/i18n'

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { validatePost } from './validate-post'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'

/**
 * Публикует пост (новый, репост или редактирование — определяется полями post).
 *
 * Флоу (идентичен comment-sender):
 *   1. Проверка авторизации и валидация поста.
 *   2. Сериализация (для OP_RETURN-хэша) и экспорт payload.
 *   3. Подбор и лок UTXO под комиссию.
 *   4. Сборка и подпись транзакции (operationType → OP_RETURN + 3-й параметр RPC).
 *   5. Отправка sendrawtransactionwithmessage.
 *
 * @returns txid опубликованного поста.
 */
export async function sendPost(post: SharePostData): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('postMsg.errAuthRequired'))

  const validationError = validatePost(post)
  if (validationError) throw new Error(t(`postMsg.validation.${validationError}`))

  const payload = exportPost(post)
  const serializedData = serializePost(post)
  const operationType = resolvePostOperationType(post)

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('postMsg.errNoUnspents'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('postMsg.errSelectUnspents'))

  lockUTXOs(selectedUnspents)

  // Отложенная публикация (settings.t > 1) → locktime/nTime в транзакции (P5).
  const delayedNtime = post.settings?.t && post.settings.t > 1 ? post.settings.t : undefined

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType,
    fee: DEFAULT_TX_FEE,
    ...(delayedNtime ? { delayedNtime } : {}),
  })

  return broadcastTransaction({
    hex: builtTx.hex,
    messageData: payload,
    operationType: operationType,
  })
}
