/**
 * Composables для работы с пользователями через Vue Query
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'
import { useRpcQuery, useRpcQueryWithAuth } from './use-rpc-query'
import type { GetUserProfileResponse, UserProfile } from '@/types/rpc-responses/user-get'
import type { GetUserStateResponse, UserState as UserStateData } from '@/types/rpc-responses/user-state'
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
 * Загружает профиль пользователя
 *
 * @param address - Адрес пользователя
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { data: profile, isLoading } = useUserProfile(userAddress)
 * ```
 */
export function useUserProfile(
  address: string | null | undefined,
  enabled: boolean = true
) {
  const authStore = useAuthStore()

  const isCurrentUser = computed(() => {
    return authStore.isUserAuthenticated && address && address === authStore.getUserAddress
  })

  // Используем тот же ключ, что и в useCurrentUserProfile, если это текущий пользователь,
  // чтобы избежать дублирования запросов и использовать общий кэш
  const queryKey = computed(() => {
    if (isCurrentUser.value) {
      return ['user', 'current-profile', address]
    }
    return ['user', 'profile', address]
  })

  return useQuery<GetUserProfileResponse>({
    queryKey,
    queryFn: async () => {
      if (!address) throw new Error('No address provided')

      if (isCurrentUser.value) {
        return getByPRCWithAuth({
          method: 'getuserprofile',
          parameters: [[address]],
          options: { auth: true }
        }) as Promise<GetUserProfileResponse>
      } else {
        return getByPRC({
          method: 'getuserprofile',
          parameters: [[address]],
          options: { auth: false }
        }) as Promise<GetUserProfileResponse>
      }
    },
    enabled: computed(() => {
      // Блокируем запрос, если идет загрузка авторизации (восстановление сессии и т.д.)
      if (authStore.isAuthLoading) {
        return false
      }

      // Если адрес передан и совпадает с адресом в authStore, но пользователь еще не авторизован (флаг isAuthenticated false),
      // значит мы находимся в процессе инициализации/авторизации.
      // В этом случае откладываем запрос, чтобы не делать лишний вызов с auth: false,
      // а дождаться завершения авторизации и сделать один вызов с auth: true.
      if (address && authStore.getUserAddress === address && !authStore.isUserAuthenticated) {
        return false
      }
      return enabled && !!address
    }),
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Загружает профили нескольких пользователей
 *
 * @param addresses - Массив адресов пользователей
 * @param enabled - Включен ли запрос
 */
export function useUserProfiles(
  addresses: string[],
  enabled: boolean = true
) {
  return useRpcQuery<GetUserProfileResponse>(
    ['user', 'profiles', addresses.sort().join(',')],
    {
      method: 'getuserprofile',
      parameters: [addresses],
      options: { auth: false }
    },
    {
      enabled: enabled && addresses.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  )
}

/**
 * Загружает состояние текущего авторизованного пользователя (с лимитами)
 * Требует авторизации
 *
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { data: userState, isLoading } = useUserState()
 * ```
 */
export function useUserState(enabled: boolean = true) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.getUserAddress)

  return useRpcQueryWithAuth<GetUserStateResponse>(
    ['user', 'state', address.value],
    {
      method: 'getuserstate',
      parameters: address.value ? [[address.value]] : [], // getuserstate принимает массив с адресом пользователя
      options: {
        auth: true,
      },
    },
    {
      enabled: enabled && !!address.value && authStore.isUserAuthenticated,
      staleTime: 2 * 60 * 1000, // 2 минуты - лимиты могут быстро меняться
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true, // Обновляем при фокусе для актуальных лимитов
    }
  )
}

/**
 * Загружает профиль текущего авторизованного пользователя
 * Требует авторизации
 *
 * @param enabled - Включен ли запрос
 */
export function useCurrentUserProfile(enabled: boolean = true) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.getUserAddress)

  return useRpcQueryWithAuth<GetUserProfileResponse>(
    ['user', 'current-profile', address.value],
    {
      method: 'getuserprofile',
      parameters: address.value ? [[address.value]] : [],
      options: {
        auth: true,
      },
    },
    {
      enabled: enabled && !!address.value && authStore.isUserAuthenticated,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  )
}

/**
 * Загружает полное состояние пользователя (профиль + лимиты)
 * Делает два запроса параллельно и объединяет результаты
 *
 * @param enabled - Включен ли запрос
 *
 * @example
 * ```vue
 * const { userState, userProfile, isLoading, isError } = useFullUserState()
 * ```
 */
export function useFullUserState(enabled: boolean = true) {
  const authStore = useAuthStore()
  const address = computed(() => authStore.getUserAddress)

  // Загружаем состояние (с лимитами)
  const {
    data: stateData,
    isLoading: isLoadingState,
    error: stateError,
  } = useUserState(enabled)

  // Загружаем профиль
  const {
    data: profileData,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useCurrentUserProfile(enabled)

  // Объединенное состояние
  const isLoading = computed(() => isLoadingState.value || isLoadingProfile.value)
  const isError = computed(() => !!stateError.value || !!profileError.value)
  const error = computed(() => stateError.value || profileError.value)

  // Извлекаем данные
  const userState = computed<UserStateData | null>(() => {
    if (!stateData.value || stateData.value.result !== 'success') {
      return null
    }

    const data = stateData.value.data
    if (Array.isArray(data) && data.length > 0) {
      return data.find((item) => item && item.address === address.value) || data[0]
    } else if (data && typeof data === 'object') {
      return data as unknown as UserStateData
    }
    return null
  })

  const userProfile = computed<UserProfile | null>(() => {
    if (!profileData.value || profileData.value.result !== 'success') {
      return null
    }

    const data = profileData.value.data
    if (Array.isArray(data) && data.length > 0) {
      return data.find((item) => item && item.address === address.value) || data[0]
    }
    return null
  })

  // Объединенные данные
  const fullUserState = computed<UserStateData | null>(() => {
    const state = userState.value
    const profile = userProfile.value

    if (!state && !profile) {
      return null
    }

    // Объединяем: приоритет лимитам из state, профилю из profile
    return {
      ...(state || {}),
      ...(profile || {}),
    } as unknown as UserStateData
  })

  return {
    userState,
    userProfile,
    fullUserState,
    isLoading,
    isError,
    error,
    refetch: () => {
      // Можно добавить refetch для обоих запросов если нужно
    },
  }
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
export function useWalletBalance(
  address: string | null | undefined,
  enabled: boolean = true
) {
  const {
    data: utxoData,
    isLoading,
    error,
    refetch,
  } = useRpcQuery<TxUnspentResponse>(
    ['wallet', 'balance', address],
    {
      method: 'txunspent',
      // Параметры: [адреса, minconf, maxconf]
      parameters: address ? [[address], 1, 9999999] : [],
      options: { auth: false }
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

  return useWalletBalance(address.value, enabled && !!address.value && authStore.isUserAuthenticated)
}
