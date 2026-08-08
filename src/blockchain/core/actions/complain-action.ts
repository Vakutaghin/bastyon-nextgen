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
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { t } from '@/i18n'

interface SendTxResponse {
  result?: string
  data?: unknown
  error?: unknown
}

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

  const response = await getByPRCWithAuth({
    method: rpcEndpoints.sendRawTransactionWithMessage,
    parameters: [builtTx.hex, messagePayload, 'modFlag'],
    options: { auth: true },
  })

  if (typeof response === 'string') return response
  const res = response as SendTxResponse | null
  if (res && typeof res === 'object' && typeof res.data === 'string') return res.data
  if (res && typeof res === 'object' && res.result === 'success' && typeof res.data === 'string') {
    return res.data
  }
  const err = res && typeof res === 'object' ? res.error : null
  throw err instanceof Error ? err : new Error(String(err ?? t('report.failed')))
}
