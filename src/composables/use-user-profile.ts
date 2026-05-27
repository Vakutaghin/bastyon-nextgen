/**
 * Composables для работы с профилями пользователей через Vue Query
 */

import { computed, type MaybeRefOrGetter, unref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall, rpcCallWithAuth } from '@/helpers/api/request'
import { useRpcQueryWithAuth } from './use-rpc-query'
import type { T_RpcRequestParams } from '@/helpers/api/request'
import type { GetUserProfileResponse, UserProfile } from '@/types/rpc-responses/user-get'
import type {
  GetUserStateResponse,
  UserState as UserStateData,
} from '@/types/rpc-responses/user-state'
import { useAuthStore } from '@/blockchain'

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
export function useUserProfile(address: string | null | undefined, enabled: boolean = true) {
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

  return useQuery<UserProfile[]>({
    queryKey,
    queryFn: async () => {
      if (!address) throw new Error('No address provided')

      if (isCurrentUser.value) {
        return rpcCallWithAuth<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[address]],
          options: { auth: true },
        })
      } else {
        return rpcCall<UserProfile[]>({
          method: rpcEndpoints.getUserProfile,
          parameters: [[address]],
          options: { auth: false },
        })
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
 * @param addresses - Массив адресов или ref/computed (реактивный список)
 * @param enabled - Включен ли запрос
 */
export function useUserProfiles(addresses: MaybeRefOrGetter<string[]>, enabled: boolean = true) {
  const addressesRef = computed(() => {
    const arr = typeof addresses === 'function' ? (addresses as () => string[])() : unref(addresses)
    return Array.isArray(arr) ? arr : []
  })
  const queryKey = computed(() => ['user', 'profiles', [...addressesRef.value].sort().join(',')])
  return useQuery<UserProfile[]>({
    queryKey,
    queryFn: () => {
      const addrs = addressesRef.value
      const params: T_RpcRequestParams = {
        method: rpcEndpoints.getUserProfile,
        parameters: [addrs],
        options: { auth: false },
      }
      return rpcCall<UserProfile[]>(params)
    },
    enabled: computed(() => enabled && addressesRef.value.length > 0),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
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
      method: rpcEndpoints.getUserState,
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
      method: rpcEndpoints.getUserProfile,
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
  const { data: stateData, isLoading: isLoadingState, error: stateError } = useUserState(enabled)

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
