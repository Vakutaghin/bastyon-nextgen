// Продвижение (буст) поста за PKOIN — транзакция `contentBoost`.
//
// Формат 1:1 с legacy (kit.js `ContentBoost`, actions.js `contentBoost`) и сверен
// с mainnet (буст 540ba509…, блок 4035441):
//   - OP_RETURN: ['contentBoost', hash256(txid поста)];
//   - payload:   { content: txid поста };
//   - выходов на чужие адреса нет: сумма буста остаётся комиссией транзакции
//     (входы − выходы), её нода и считает бустом в `getboostfeed`. Автор поста
//     этих монет не получает.
//
// Нода отказывает, если поста нет или он удалён, если между автором и
// продвигающим блокировка и если аккаунт не зарегистрирован
// (pocketnet.core, consensus/social/BoostContent.hpp).

import { useAuthStore } from '@/blockchain'
import { buildTransaction } from '../transactions/transaction-builder'
import {
  getUnspents,
  filterAvailableUnspents,
  selectAndLockUnspents,
  unlockUTXOs,
} from '../transactions/unspents-manager'
import { broadcastTransaction } from '../transactions/transaction-sender'
import { NodeRejectError } from '../transactions/node-reject'
import { DEFAULT_TX_FEE } from '../../constants/transactions'
import { BOOST_MIN_PKOIN } from '@/helpers/content/boost'
import { formatPkoinAmount } from '@/helpers/common/pkoin-formatter'
import { t } from '@/i18n'

const TXID_RE = /^[0-9a-f]{64}$/i

/**
 * Продвигает пост `contentTxid` на `amount` PKOIN. Сверху уходит обычная
 * комиссия сети — 1 сатоши. Возвращает txid буста. `title` — подпись поста
 * в «песочных часах», пока буст ждёт блока.
 */
export async function boostPost(
  contentTxid: string,
  amount: number,
  title?: string
): Promise<string> {
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const address = authStore.getUserAddress

  if (!keyPair || !address) throw new Error(t('boost.errAuthRequired'))
  if (!TXID_RE.test(contentTxid)) throw new Error(t('boost.errNoPost'))
  if (!Number.isFinite(amount) || amount < BOOST_MIN_PKOIN) {
    throw new Error(t('boost.errMin', { min: formatPkoinAmount(BOOST_MIN_PKOIN) }))
  }

  const total = amount + DEFAULT_TX_FEE
  let unspents = await getUnspents(address, 1, 9999999)
  unspents = filterAvailableUnspents(unspents, false)
  const selected = selectAndLockUnspents(unspents, total)
  if (!selected.length) throw new Error(t('boost.errInsufficient'))

  try {
    const built = await buildTransaction({
      unspents: selected,
      fromAddress: address,
      keyPair,
      serializedData: contentTxid,
      operationType: 'contentBoost',
      // Сдача = входы − буст − комиссия: буст остаётся комиссией транзакции.
      fee: total,
    })

    return await broadcastTransaction({
      hex: built.hex,
      messageData: { content: contentTxid },
      operationType: 'contentBoost',
      pending: { postId: contentTxid, amount, ...(title ? { title } : {}) },
    })
  } catch (error) {
    // Нода отвергла буст — монеты не ушли, пусть следующая попытка их видит.
    if (error instanceof NodeRejectError) unlockUTXOs(selected)
    throw error
  }
}
