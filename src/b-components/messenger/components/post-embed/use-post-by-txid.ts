import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { adaptPostData, type AdaptedPost } from '@/helpers/common/post-mapper'

/**
 * Загружает один пост по txid (`getrawtransactionwithmessagebyid`)
 * и адаптирует под формат AdaptedPost (тот же, что использует лента).
 * Кэширование — Vue Query: одинаковый txid в нескольких чатах = один сетевой запрос.
 *
 * Используем `useQuery` напрямую (а не наш `useRpcQueryWithAuth`),
 * чтобы динамически читать значение `txidRef` внутри `queryFn` —
 * иначе параметры запроса замыкаются один раз на этапе вызова composable.
 */
export const usePostByTxid = (txidRef: Ref<string | null | undefined>) => {
  const enabled = computed(() => {
    const t = txidRef.value
    return !!t && /^[a-f0-9]{64}$/i.test(t)
  })

  const query = useQuery<unknown>({
    queryKey: ['messenger', 'post-embed', txidRef],
    queryFn: async () => {
      const txid = txidRef.value
      if (!txid) return null
      return getByPRCWithAuth({
        method: rpcEndpoints.getRawTransactionWithMessageById,
        parameters: [[txid]],
      })
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  /**
   * Извлекает первый пост из ответа API.
   * Формат ответа RPC может отличаться: массив, {data: [...]}, {contents: [...]}, и т.п.
   */
  const post = computed<AdaptedPost | null>(() => {
    const raw = query.data.value as any
    if (!raw) return null
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.contents)
          ? raw.contents
          : Array.isArray(raw?.data?.contents)
            ? raw.data.contents
            : []
    const first = list[0]
    if (!first) return null
    return adaptPostData(first, 0)
  })

  const isMissing = computed<boolean>(() => {
    // Запрос завершён успешно, но пост не пришёл — txid не найден в ноде
    return !query.isFetching.value && !query.isError.value && post.value === null && enabled.value
  })

  return {
    post,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isMissing,
    error: query.error,
  }
}
