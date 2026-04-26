/**
 * Composable для выполнения RPC мутаций (изменяющих запросов) через Vue Query
 */

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/vue-query'
import type { T_RpcRequestParams, RpcRequestConfig } from '@/helpers/api/request'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'

/**
 * Опции для useRpcMutation
 */
export interface UseRpcMutationOptions<TData = unknown, TVariables = T_RpcRequestParams> {
  /** Ключи запросов для инвалидации после успешной мутации */
  invalidateQueries?: (string | number)[][]
  /** Конфигурация RPC запроса (host, port) */
  rpcConfig?: RpcRequestConfig
  /** Дополнительные опции для Vue Query mutation */
  mutationOptions?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
}

/**
 * Выполняет RPC мутацию (изменяющий запрос) через Vue Query
 *
 * @param params - Параметры RPC запроса (или функция для их получения)
 * @param options - Опции мутации
 * @returns Результат useMutation из Vue Query
 *
 */
export function useRpcMutation<TData = unknown>(
  params: T_RpcRequestParams | ((variables: any) => T_RpcRequestParams),
  options?: UseRpcMutationOptions<TData>
) {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, any>({
    mutationFn: async (variables?: any) => {
      const requestParams = typeof params === 'function' ? params(variables) : params
      return getByPRC(requestParams, options?.rpcConfig) as Promise<TData>
    },
    onSuccess: (data, variables, context) => {
      // Инвалидируем указанные запросы после успешной мутации
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      // Вызываем пользовательский onSuccess если он есть
      options?.mutationOptions?.onSuccess?.(data, variables, context)
    },
    ...options?.mutationOptions,
  })
}

/**
 * Выполняет авторизованную RPC мутацию через Vue Query
 *
 * @param params - Параметры RPC запроса (или функция для их получения)
 * @param options - Опции мутации
 * @returns Результат useMutation из Vue Query
 *
 * @example
 * ```ts
 * const { mutate, isPending } = useRpcMutationWithAuth({
 *   method: 'content.add',
 *   parameters: [contentData],
 *   options: { auth: true }
 * }, {
 *   invalidateQueries: [['feed']]
 * })
 * ```
 */
export function useRpcMutationWithAuth<TData = unknown>(
  params: T_RpcRequestParams | ((variables: any) => T_RpcRequestParams),
  options?: UseRpcMutationOptions<TData>
) {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, any>({
    mutationFn: async (variables?: any) => {
      const requestParams = typeof params === 'function' ? params(variables) : params
      return getByPRCWithAuth(requestParams, options?.rpcConfig) as Promise<TData>
    },
    onSuccess: (data, variables, context) => {
      // Инвалидируем указанные запросы после успешной мутации
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey })
        })
      }
      // Вызываем пользовательский onSuccess если он есть
      options?.mutationOptions?.onSuccess?.(data, variables, context)
    },
    ...options?.mutationOptions,
  })
}
