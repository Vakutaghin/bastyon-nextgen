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
// Нода принимает флаг только от аккаунта с бейджем «shark» (pocketnet.core,
// consensus/moderation/Flag.hpp: иначе LowReputation, код 66). Старый клиент
// поэтому отправлял его только «акулам»; окно жалобы проверяет право заранее
// (`accountCanFlag`), чтобы не собирать транзакцию, которую сеть отвергнет.

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
  unlockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { NodeRejectError } from '@/blockchain/core/transactions/node-reject'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
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

  try {
    const builtTx = await buildTransaction({
      unspents: selectedUnspents,
      fromAddress: address,
      keyPair,
      serializedData,
      operationType: 'modFlag',
      fee: DEFAULT_TX_FEE,
    })

    return await broadcastTransaction({
      hex: builtTx.hex,
      messageData: messagePayload,
      operationType: 'modFlag',
      // Жалоба бывает и на пост, и на комментарий — показываем автора.
      pending: { address: authorAddress },
    })
  } catch (error) {
    // Нода отвергла жалобу — монета не потрачена, следующее действие её возьмёт.
    if (error instanceof NodeRejectError) unlockUTXOs(selectedUnspents)
    throw error
  }
}

/**
 * Может ли аккаунт жаловаться: у него бейдж «shark». `null` — узнать не
 * удалось (нода не ответила); тогда решает сама сеть при отправке.
 */
export async function accountCanFlag(
  address: string,
  request: typeof getByPRC = getByPRC
): Promise<boolean | null> {
  if (!address) return false
  try {
    const response = await request({
      method: rpcEndpoints.getUserProfile,
      parameters: [[address], '1'],
      options: { auth: false },
    })
    const list = Array.isArray(response) ? response : (response as { data?: unknown } | null)?.data
    if (!Array.isArray(list)) return null
    const profile = list.find(
      (p): p is { address?: string; badges?: unknown } =>
        !!p && typeof p === 'object' && (p as { address?: string }).address === address
    )
    // Профиля нет — аккаунт не зарегистрирован, жаловаться ему нельзя.
    if (!profile) return false
    return Array.isArray(profile.badges) && profile.badges.includes('shark')
  } catch {
    return null
  }
}
