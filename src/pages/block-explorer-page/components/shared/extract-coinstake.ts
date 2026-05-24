/**
 * Извлечение информации о PoS-вознаграждении из coinstake-транзакции блока.
 *
 * Pocketnet — PoS-сеть. В каждом не-генезис-блоке первая транзакция (rowNumber=0,
 * type=3) — coinstake: один vin (стейкер вкладывает) и один payout-vout с возвратом
 * входной суммы + награды. Признаки:
 *   - type === 3
 *   - vout[0] пустой (value=0, scriptPubKey.hex='') — обязательный маркер coinstake
 *   - vin[0].address === vout[1].scriptPubKey.addresses[0] (награда уходит стейкеру)
 *
 * Награда = sum(vout.value) − sum(vin.value). Используем сумму, а не разницу
 * только vout[1]−vin[0], потому что у некоторых блоков может быть split-payout
 * на несколько vout-ов (нечасто, но встречается).
 *
 * Если ни одной coinstake-tx не найдено — возвращаем null. PoW-coinbase
 * (type=1) обрабатывается отдельно: там нет vin[].value, награда = sum(vout.value).
 */

import type { Transaction } from '@/types/rpc-responses/get-transactions'

export interface CoinstakeInfo {
  /** Адрес стейкера / майнера. */
  staker: string
  /** Награда блока в PKOIN. Для PoS = totalOut − totalIn; для PoW = totalOut. */
  reward: number
  /** 'pos' (coinstake, type=3) или 'pow' (coinbase, type=1). */
  kind: 'pos' | 'pow'
}

const COINBASE_TYPE = 1
const COINSTAKE_TYPE = 3

export function extractCoinstakeInfo(txs: Transaction[]): CoinstakeInfo | null {
  if (!txs || txs.length === 0) return null

  // Coinstake-tx обычно первая (rowNumber=0). Если массив отдан не сортированным,
  // ищем по типу.
  const coinstake = txs.find((tx) => tx.type === COINSTAKE_TYPE)
  if (coinstake) {
    const totalIn = coinstake.vin.reduce((s, v) => s + (v.value ?? 0), 0)
    const totalOut = coinstake.vout.reduce((s, v) => s + (v.value ?? 0), 0)
    const reward = totalOut - totalIn
    const staker = coinstake.vin[0]?.address ?? ''
    if (!staker) return null
    return { staker, reward: reward > 0 ? reward : 0, kind: 'pos' }
  }

  // Fallback: PoW-coinbase (премайн / early-blocks).
  const coinbase = txs.find((tx) => tx.type === COINBASE_TYPE)
  if (coinbase) {
    const totalOut = coinbase.vout.reduce((s, v) => s + (v.value ?? 0), 0)
    // У coinbase-tx первый vout обычно несёт всю награду на адрес майнера.
    const minerVout = coinbase.vout.find(
      (v) => v.value > 0 && v.scriptPubKey?.addresses?.[0],
    )
    const staker = minerVout?.scriptPubKey?.addresses?.[0] ?? ''
    if (!staker) return null
    return { staker, reward: totalOut, kind: 'pow' }
  }

  return null
}

/**
 * Количество подтверждений блока. Tip имеет 1 подтверждение.
 * Возвращает 0 если данных недостаточно (отрицательный результат — некорректное состояние).
 */
export function calcConfirmations(blockHeight: number, tipHeight: number): number {
  if (!Number.isFinite(blockHeight) || !Number.isFinite(tipHeight)) return 0
  const c = tipHeight - blockHeight + 1
  return c > 0 ? c : 0
}
