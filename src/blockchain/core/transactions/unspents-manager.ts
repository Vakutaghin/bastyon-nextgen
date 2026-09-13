/**
 * Модуль для работы с unspents (UTXO)
 */

import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall } from '@/helpers/api/request'
import type { UTXO } from '@/composables/use-wallet-queries'
import {
  DUST_VALUE,
  OPTIMIZE_UNSPENTS_MAX,
  POCKETNET_TX_MATURITY,
  COINBASE_MATURITY,
} from '@/blockchain/constants/transactions'

// Локальный лок UTXO: пока нода не увидела нашу транзакцию, txunspent продолжает
// отдавать потраченные входы — вторая отправка подряд подобрала бы те же UTXO и
// либо получила бы reject, либо (при провале первой) молча уехала бы вместо неё.
// Ключ → таймер авто-снятия: повторный лок ПРОДЛЕВАЕТ TTL (S6), а не оставляет
// таймер первого лока, который снимал бы блокировку раньше времени.
const lockedUTXOs = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Lock UTXOs to prevent them from being used in subsequent transactions immediately
 * @param utxos - List of UTXOs to lock
 * @param ttl - Time to live in ms (default 60000ms = 1 min)
 */
export function lockUTXOs(utxos: UTXO[], ttl: number = 60000) {
  utxos.forEach((u) => {
    const key = `${u.txid}:${u.vout}`
    const prev = lockedUTXOs.get(key)
    if (prev) clearTimeout(prev)
    lockedUTXOs.set(
      key,
      setTimeout(() => lockedUTXOs.delete(key), ttl)
    )
  })
}

/**
 * Подбирает входы под сумму и сразу лочит их. Единая точка для ВСЕХ отправителей
 * (контентные и value-транзакции): раньше лок был в 8 из 15 мест (аудит P2-5/S6).
 * Пустой результат = не хватает средств (ничего не лочится).
 * @param available - unspents, уже прошедшие filterAvailableUnspents
 * @param requiredAmount - сумма в PKOIN (0 = «любой один вход», как для регистрации)
 */
export function selectAndLockUnspents(available: UTXO[], requiredAmount: number): UTXO[] {
  const selected = selectBestUnspents(available, requiredAmount)
  // selectBestUnspents при нехватке отдаёт «всё, что есть» — для отправителя это
  // не подбор, а гарантированный reject билдера; не лочим и отдаём пусто.
  const total = selected.reduce((sum, u) => sum + u.amount, 0)
  if (!selected.length || total + 1e-9 < requiredAmount) return []
  lockUTXOs(selected)
  return selected
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
  server?: { host: string; port: number }
): Promise<UTXO[]> {
  // rpcCall unwraps the { result, data } envelope and throws on error
  return await rpcCall<UTXO[]>(
    {
      method: rpcEndpoints.txUnspent,
      parameters: [[address], minConf, maxConf],
      options: { auth: false },
    },
    server
  )
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
  const optimizeUnspents = targetAmount < 0.0000001 && unspents.length > OPTIMIZE_UNSPENTS_MAX

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
    (addedAmount < dustThreshold ||
      addedAmount < targetAmount ||
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
export function filterAvailableUnspents(unspents: UTXO[], onlyConfirmed: boolean = false): UTXO[] {
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
