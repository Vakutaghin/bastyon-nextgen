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
  feeUnspents,
  filterAvailableUnspents,
  lockUTXOs,
  selectBestUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { t } from '@/i18n'

import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { validatePost } from './validate-post'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'
import { pendingSnippet } from '@/blockchain/core/transactions/broadcast-events'

/**
 * Публикует пост (новый, репост или редактирование — определяется полями post).
 *
 * Флоу (идентичен comment-sender):
 *   1. Проверка авторизации и валидация поста.
 *   2. Сериализация (для OP_RETURN-хэша) и экспорт payload.
 *   3. Подбор и лок UTXO под комиссию (монеты запрошены заранее — feeUnspents).
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

  let unspents = filterAvailableUnspents(await feeUnspents(address), false)
  let selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  // Запомненный список мог устареть: пришли новые монеты, дозрели старые.
  if (selectedUnspents.length === 0) {
    unspents = filterAvailableUnspents(await feeUnspents(address, { fresh: true }), false)
    selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  }
  if (!unspents.length) throw new Error(t('postMsg.errNoUnspents'))
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
    // Правка — в общих «песочных часах». Новый пост часы показывают из своего
    // стора (pending-posts), но блок за ним следит тот же трекер.
    pending: post.txidEdit
      ? {
          kind: 'postEdit',
          postId: post.txidEdit,
          title: pendingSnippet(post.caption) ?? pendingSnippet(post.message),
        }
      : {
          kind: 'post',
          title: pendingSnippet(post.caption) ?? pendingSnippet(post.message),
          ...(delayedNtime ? { notBefore: delayedNtime * 1000 } : {}),
        },
  })
}
