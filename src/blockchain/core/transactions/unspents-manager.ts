/**
 * Модуль для работы с unspents (UTXO)
 */

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall } from '@/helpers/api/request'
import type { UTXO } from '@/composables/use-user-queries'
import {
  DUST_VALUE,
  OPTIMIZE_UNSPENTS_MAX,
  POCKETNET_TX_MATURITY,
  COINBASE_MATURITY
} from '@/blockchain/constants/transactions'

// Local cache of locked UTXOs to prevent double-spending in rapid transactions
const lockedUTXOs = new Set<string>()

/**
 * Lock UTXOs to prevent them from being used in subsequent transactions immediately
 * @param utxos - List of UTXOs to lock
 * @param ttl - Time to live in ms (default 60000ms = 1 min)
 */
export function lockUTXOs(utxos: UTXO[], ttl: number = 60000) {
  utxos.forEach(u => {
    const key = `${u.txid}:${u.vout}`
    lockedUTXOs.add(key)

    // Auto-unlock after TTL
    setTimeout(() => {
      lockedUTXOs.delete(key)
    }, ttl)
  })
}

/**
 * Получает unspents для указанного адреса
 * @param address - Адрес кошелька
 * @param minConf - Минимальное количество подтверждений (по умолчанию 1)
 * @param maxConf - Максимальное количество подтверждений (по умолчанию 9999999)
 * @returns Promise с массивом unspents
 */
export async function getUnspents(
  address: string,
  minConf: number = 1,
  maxConf: number = 9999999,
  server?: { host: string; port: number },
): Promise<UTXO[]> {
  // rpcCall unwraps the { result, data } envelope and throws on error
  return await rpcCall<UTXO[]>({
    method: rpcEndpoints.txUnspent,
    parameters: [[address], minConf, maxConf],
    options: { auth: false },
  }, server)
}

/**
 * Выбирает лучшие unspents для транзакции
 * Алгоритм выбирает unspents так, чтобы покрыть нужную сумму с минимальным количеством входов
 * @param unspents - Массив доступных unspents
 * @param requiredAmount - Требуемая сумма в PKOIN
 * @returns Массив выбранных unspents
 */
export function selectBestUnspents(unspents: UTXO[], requiredAmount: number): UTXO[] {
  if (!unspents || unspents.length === 0) {
    return []
  }

  // Если сумма равна 0, используем минимальное значение
  let targetAmount = requiredAmount
  if (targetAmount === 0) {
    targetAmount = 0.00000001
  }

  // Определяем, нужно ли оптимизировать количество unspents
  const optimizeUnspents =
    targetAmount < 0.0000001 && unspents.length > OPTIMIZE_UNSPENTS_MAX

  // Вычисляем общую сумму всех unspents
  const totalAmount = unspents.reduce((sum, u) => sum + u.amount, 0)

  // Если общая сумма меньше dust value, используем все unspents
  let dustThreshold = DUST_VALUE
  if (totalAmount < DUST_VALUE) {
    dustThreshold = 0
  }

  const selected: Record<string, UTXO> = {}
  let addedAmount = 0

  // Сортируем unspents по сумме для лучшего выбора
  const sortedUnspents = [...unspents].sort((a, b) => a.amount - b.amount)

  // Выбираем unspents пока не наберем нужную сумму
  while (
    (addedAmount < dustThreshold || addedAmount < targetAmount ||
     (optimizeUnspents && Object.keys(selected).length < 5)) &&
    sortedUnspents.length > 0
  ) {
    const diff = Math.max(Math.max(targetAmount, dustThreshold) - addedAmount, 0)

    // Берем первые 5 unspents, наиболее близких к нужной разнице
    const candidates = sortedUnspents
      .slice(0, Math.min(5, sortedUnspents.length))
      .sort((a, b) => Math.abs(a.amount - diff) - Math.abs(b.amount - diff))

    if (candidates.length === 0) break

    // Выбираем случайный из кандидатов (или первый, если один)
    const selectedUnspent = candidates[Math.floor(Math.random() * candidates.length)]
    if (!selectedUnspent) break
    const key = `${selectedUnspent.txid}:${selectedUnspent.vout}`

    selected[key] = selectedUnspent
    addedAmount += selectedUnspent.amount

    // Удаляем выбранный unspent из списка
    const index = sortedUnspents.findIndex(
      (u) => u.txid === selectedUnspent.txid && u.vout === selectedUnspent.vout
    )
    if (index !== -1) {
      sortedUnspents.splice(index, 1)
    }
  }

  return Object.values(selected)
}

/**
 * Фильтрует unspents, оставляя только готовые к использованию
 * @param unspents - Массив unspents
 * @param onlyConfirmed - Только подтвержденные (по умолчанию false)
 * @returns Отфильтрованный массив unspents
 */
export function filterAvailableUnspents(
  unspents: UTXO[],
  onlyConfirmed: boolean = false
): UTXO[] {
  return unspents.filter((u) => {
    // Check if UTXO is locally locked
    if (lockedUTXOs.has(`${u.txid}:${u.vout}`)) {
      return false
    }

    // Исключаем unspents с нулевой суммой
    if (!u.amount || u.amount <= 0) {
      return false
    }

    // Если требуется только подтвержденные, проверяем confirmations
    if (onlyConfirmed && (!u.confirmations || u.confirmations < 1)) {
      return false
    }

    // Проверка на зрелость coinbase транзакций
    if (u.coinbase && (!u.confirmations || u.confirmations < COINBASE_MATURITY)) {
      return false
    }

    // Проверка на зрелость pockettx транзакций
    if (u.pockettx && (!u.confirmations || u.confirmations < POCKETNET_TX_MATURITY)) {
      return false
    }

    return true
  })
}
