/**
 * Composables для работы с кошельком и балансом через Vue Query
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRCWithAuth } from '@/helpers/api/request'
import { useRpcQuery } from './use-rpc-query'
import { useAuthStore } from '@/blockchain'
import type { GetAccountEarningResponse } from '@/types/rpc-responses/get-account-earning'

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
 * Верхняя граница блока для getaccountearning. Legacy хардкодил `1627534`, что
 * со временем обрезает недавний заработок; передаём заведомо большое значение,
 * чтобы окно покрывало всю историю.
 */
const EARNINGS_TO_BLOCK = 999_999_999

/** Заработок аккаунта (лотерея/донаты/переводы) в PKOIN. */
export interface AccountEarnings {
  /** Получено из blockchain-лотереи */
  lottery: number
  /** Получено донатов */
  donation: number
  /** Совершено переводов */
  transfer: number
}

/**
 * Загружает заработок аккаунта через `getaccountearning` (требует авторизации).
 *
 * Сверено с legacy (`js/satolist.js`): `rpc('getaccountearning', [address, 0, 1627534])`,
 * берётся `s[0]`, поля делятся на 1e8 (сатоши → PKOIN).
 *
 * @param address - Адрес пользователя (если не задан — текущий авторизованный)
 * @param enabled - Включён ли запрос
 */
export function useAccountEarnings(address?: string | null, enabled: boolean = true) {
  const authStore = useAuthStore()
  const targetAddress = computed<string | null>(() => address ?? authStore.getUserAddress ?? null)

  // useQuery напрямую (не useRpcQueryWithAuth), чтобы queryKey/enabled/parameters
  // были реактивны: запрос должен сам перезапускаться при логине/смене аккаунта.
  const { data, isLoading, error, refetch } = useQuery<GetAccountEarningResponse>({
    queryKey: computed(() => ['wallet', 'earnings', targetAddress.value]),
    queryFn: () =>
      getByPRCWithAuth({
        method: rpcEndpoints.getAccountEarning,
        parameters: [targetAddress.value as string, 0, EARNINGS_TO_BLOCK],
        options: { auth: true },
      }) as Promise<GetAccountEarningResponse>,
    enabled: computed(() => enabled && !!targetAddress.value && authStore.isUserAuthenticated),
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000,
  })

  /**
   * Заработок в PKOIN (сатоши / 1e8). null пока данные не получены.
   * Устойчив к обёртке ответа: rpc-ex может вернуть `{result, data: [...]}`
   * либо (как legacy `app.api.rpc`) голый массив.
   */
  const earnings = computed<AccountEarnings | null>(() => {
    const resp = data.value as unknown
    if (!resp) return null

    let items: GetAccountEarningResponse['data'] | null = null
    if (Array.isArray(resp)) {
      items = resp as GetAccountEarningResponse['data']
    } else if (typeof resp === 'object') {
      const envelope = resp as GetAccountEarningResponse
      if (envelope.result && envelope.result !== 'success') return null
      if (Array.isArray(envelope.data)) items = envelope.data
    }
    if (!items) return null

    const item = items[0]
    if (!item) return { lottery: 0, donation: 0, transfer: 0 }
    return {
      lottery: (Number(item.amountLottery) || 0) / 100_000_000,
      donation: (Number(item.amountDonation) || 0) / 100_000_000,
      transfer: (Number(item.amountTransfer) || 0) / 100_000_000,
    }
  })

  return {
    /** Заработок в PKOIN (lottery/donation/transfer) или null */
    earnings,
    /** Сырой ответ RPC */
    data,
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
