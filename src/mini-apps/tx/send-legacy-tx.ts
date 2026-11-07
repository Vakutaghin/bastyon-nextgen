/**
 * Отправка транзакции мини-приложения (legacy-objects): выбрать монеты,
 * собрать с OP_RETURN [тип, hash256(serialized), extra?], отправить. Ожидание
 * блока видно в «песочных часах» с именем приложения.
 */

import { Buffer } from 'buffer'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { buildTransaction } from '@/blockchain/core/transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectBestUnspents,
  lockUTXOs,
  unlockUTXOs,
} from '@/blockchain/core/transactions/unspents-manager'
import { broadcastTransaction } from '@/blockchain/core/transactions/transaction-sender'
import { NodeRejectError } from '@/blockchain/core/transactions/node-reject'
import type { PendingMeta } from '@/blockchain/core/transactions/broadcast-events'
import { DEFAULT_TX_FEE } from '@/blockchain/constants/transactions'
import { t } from '@/i18n'

import type { LegacyTxObject } from './legacy-objects'

/** Возвращает txid. Бросает NodeRejectError с текстом для человека, если нода отказала. */
export async function sendLegacyTx(obj: LegacyTxObject, pending: PendingMeta): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress
  if (!keyPair || !address) throw new Error(t('miniapps.txNotSignedIn'))

  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectBestUnspents(unspents ?? [], DEFAULT_TX_FEE)
  if (!selected.length) throw new Error(t('miniapps.txNoCoins'))
  lockUTXOs(selected)

  try {
    const built = await buildTransaction({
      unspents: selected,
      fromAddress: address,
      keyPair,
      serializedData: obj.serialized,
      operationType: obj.type,
      ...(obj.opReturnExtra ? { opReturnData: [Buffer.from(obj.opReturnExtra, 'utf8')] } : {}),
      fee: DEFAULT_TX_FEE,
    })
    return await broadcastTransaction({
      hex: built.hex,
      messageData: obj.message,
      operationType: obj.type,
      pending,
    })
  } catch (error) {
    // Нода отвергла — монеты не ушли, следующая попытка должна их видеть.
    if (error instanceof NodeRejectError) unlockUTXOs(selected)
    throw error
  }
}
