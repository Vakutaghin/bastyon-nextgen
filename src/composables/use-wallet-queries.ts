/**
 * Composables для работы с кошельком и балансом через Vue Query
 */

import { computed } from 'vue'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { useRpcQuery } from './use-rpc-query'
import { useAuthStore } from '@/blockchain'

/**
 * Интерфейс для UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  /** ID транзакции */
  txid: string
  /** Индекс выхода в транзакции */
  vout: number
  /** Сумма в минимальных единицах (сатоши) */
  amount: number
  /** Адрес */
  address?: string
  /** Подтверждения */
  confirmations?: number
  /** ScriptPubKey */
  scriptPubKey?: string
  /** Высота блока */
  height?: number
  /** Является ли транзакция Pocketnet (pockettx) */
  pockettx?: boolean
  /** Является ли транзакция coinbase */
  coinbase?: boolean
}

/**
 * Ответ txunspent API
 */
export interface TxUnspentResponse {
  result: 'success' | 'error'
  data: UTXO[]
  node?: string
  error?: string
}

/**
 * Загружает баланс кошелька через txunspent
 *
 * Баланс вычисляется как сумма всех UTXO (непотраченных выходов транзакций).
 *
 * @param address - Адрес кошелька
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { balance, isLoading } = useWalletBalance(userAddress)
 * ```
 */
export function useWalletBalance(address: string | null | undefined, enabled: boolean = true) {
  const {
    data: utxoData,
    isLoading,
    error,
    refetch,
  } = useRpcQuery<TxUnspentResponse>(
    ['wallet', 'balance', address],
    {
      method: rpcEndpoints.txUnspent,
      // Параметры: [адреса, minconf, maxconf]
      parameters: address ? [[address], 1, 9999999] : [],
      options: { auth: false },
    },
    {
      enabled: enabled && !!address,
      staleTime: 30 * 1000, // 30 секунд - баланс может часто меняться
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    }
  )

  // Вычисляем баланс из UTXO
  const balance = computed<number | null>(() => {
    if (!utxoData.value) {
      return null
    }

    // Обрабатываем разные форматы ответа
    let utxos: UTXO[] = []

    if (utxoData.value.result === 'success' && Array.isArray(utxoData.value.data)) {
      utxos = utxoData.value.data
    } else if (Array.isArray(utxoData.value)) {
      // Если ответ напрямую массив UTXO
      utxos = utxoData.value as unknown as UTXO[]
    }

    if (utxos.length === 0) {
      return 0
    }

    // Суммируем все amount из UTXO
    const total = utxos.reduce((sum, utxo) => {
      const amount = typeof utxo.amount === 'number' ? utxo.amount : 0
      return sum + amount
    }, 0)

    return total
  })

  // Баланс в PKOIN (конвертируем из минимальных единиц)
  const balanceInPkoin = computed<number | null>(() => {
    if (balance.value === null) {
      return null
    }
    // 1 PKOIN = 100,000,000 минимальных единиц
    return balance.value / 100000000
  })

  return {
    /** Баланс в минимальных единицах (сатоши) */
    balance,
    /** Баланс в PKOIN */
    balanceInPkoin,
    /** Сырые данные UTXO */
    utxoData,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Загружает баланс текущего авторизованного пользователя
 *
 * @param enabled - Включен ли запрос
 */
export function useCurrentUserBalance(enabled: boolean = true) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.getUserAddress)

  return useWalletBalance(
    address.value,
    enabled && !!address.value && authStore.isUserAuthenticated
  )
}
