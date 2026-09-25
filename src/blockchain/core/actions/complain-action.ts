// Жалоба на контент (пост/коммент) через modFlag-транзакцию.
//
// Формат 1:1 из legacy `ModFlag` (kit.js:895-974):
//   - operationType: 'modFlag'
//   - serialize():   s2 + s3 + i1  (= contentHash + authorAddress + reason)
//   - payload:       { s2, s3, i1 }
//
// Механизм сборки/отправки — как у проверенного contentDelete (post-deleter.ts) и
// commentDelete (comment-deleter.ts). modFlag — нативный механизм модерации
// протокола (jury/«shark»), без посредников (принцип `principle_decentralization`).
//
// ⚠️ На живой ноде не верифицировано (нет стенда). Приём флага от не-модератора —
// вопрос протокола ноды: при отказе пользователь увидит ошибку из ответа RPC.

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { t } from '@/i18n'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'

export interface ComplaintParams {
  /** s2 — txid поста/коммента. */
  contentHash: string
  /** s3 — адрес автора контента. */
  authorAddress: string
  /** i1 — код причины (gid 1..6). */
  reason: number
}

/**
 * Отправляет жалобу на контент (modFlag). Возвращает txid транзакции.
 */
export async function sendComplaint(params: ComplaintParams): Promise<string> {
  const { contentHash, authorAddress, reason } = params

  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('report.authRequired'))
  if (!contentHash || !authorAddress || !reason) throw new Error(t('report.failed'))

  // ModFlag.serialize() = s2 + s3 + i1; export() = { s2, s3, i1 }.
  const serializedData = `${contentHash}${authorAddress}${reason}`
  const messagePayload = { s2: contentHash, s3: authorAddress, i1: reason }

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  if (!unspents?.length) throw new Error(t('report.failed'))

  const selectedUnspents = selectBestUnspents(unspents, DEFAULT_TX_FEE)
  if (selectedUnspents.length === 0) throw new Error(t('report.failed'))

  lockUTXOs(selectedUnspents)

  const builtTx = await buildTransaction({
    unspents: selectedUnspents,
    fromAddress: address,
    keyPair,
    serializedData,
    operationType: 'modFlag',
    fee: DEFAULT_TX_FEE,
  })

  return broadcastTransaction({
    hex: builtTx.hex,
    messageData: messagePayload,
    operationType: 'modFlag',
  })
}
