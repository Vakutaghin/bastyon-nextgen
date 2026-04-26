/**
 * Composable для выполнения RPC запросов с кэшированием через Vue Query
 */

import { useQuery, type UseQueryOptions } from '@tanstack/vue-query'
import type { T_RpcRequestParams, RpcRequestConfig } from '@/helpers/api/request'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'

/**
 * Опции для useRpcQuery
 */
export interface UseRpcQueryOptions<TData = unknown> {
  /** Включен ли запрос (можно использовать для условных запросов) */
  enabled?: boolean
  /** Время, в течение которого данные считаются свежими (в миллисекундах) */
  staleTime?: number
  /** Время хранения кэша после последнего использования (в миллисекундах) */
  gcTime?: number
  /** Количество повторных попыток при ошибке */
  retry?: number | boolean
  /** Рефетч при фокусе окна */
  refetchOnWindowFocus?: boolean
  /** Рефетч при переподключении */
  refetchOnReconnect?: boolean
  /** Интервал автоматического рефетча (в миллисекундах) */
  refetchInterval?: number | false
  /** Дополнительные опции для Vue Query */
  queryOptions?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
  /** Конфигурация RPC запроса (host, port) */
  rpcConfig?: RpcRequestConfig
}

/**
 * Выполняет RPC запрос с кэшированием через Vue Query
 *
 * @param queryKey - Уникальный ключ для кэширования (массив строк/чисел)
 * @param params - Параметры RPC запроса
 * @param options - Опции запроса
 * @returns Результат useQuery из Vue Query
 *
 * @example
 * ```ts
 * const { data, isLoading, error } = useRpcQuery(
 *   ['user', 'profile', userId],
 *   {
 *     method: 'user.get',
 *     parameters: [userId],
 *     options: { auth: false }
 *   }
 * )
 * ```
 */
export function useRpcQuery<TData = unknown>(
  queryKey: readonly unknown[],
  params: T_RpcRequestParams,
  options?: UseRpcQueryOptions<TData>
) {
  return useQuery<TData>({
    queryKey,
    queryFn: () => getByPRC(params, options?.rpcConfig) as Promise<TData>,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    retry: options?.retry,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
    refetchInterval: options?.refetchInterval,
    ...options?.queryOptions,
  })
}

/**
 * Выполняет авторизованный RPC запрос с кэшированием через Vue Query
 *
 * @param queryKey - Уникальный ключ для кэширования (массив строк/чисел)
 * @param params - Параметры RPC запроса
 * @param options - Опции запроса
 * @returns Результат useQuery из Vue Query
 *
 * @example
 * ```ts
 * const { data, isLoading, error } = useRpcQueryWithAuth(
 *   ['user', 'state'],
 *   {
 *     method: 'user.getstate',
 *     parameters: [],
 *     options: { auth: true }
 *   }
 * )
 * ```
 */
export function useRpcQueryWithAuth<TData = unknown>(
  queryKey: readonly unknown[],
  params: T_RpcRequestParams,
  options?: UseRpcQueryOptions<TData>
) {
  return useQuery<TData>({
    queryKey,
    queryFn: () => getByPRCWithAuth(params, options?.rpcConfig) as Promise<TData>,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    retry: options?.retry,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
    refetchInterval: options?.refetchInterval,
    ...options?.queryOptions,
  })
}
