/**
 * Глобальный QueryClient для Vue Query
 * Экспортируется отдельно, чтобы избежать циклических зависимостей
 */

import { QueryClient } from '@tanstack/vue-query'

const MINUTE_MS = 60 * 1000
const QUERY_STALE_TIME_MS = 5 * MINUTE_MS
const QUERY_GC_TIME_MS = 10 * MINUTE_MS
const QUERY_RETRY_COUNT = 2
const MUTATION_RETRY_COUNT = 1

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      gcTime: QUERY_GC_TIME_MS,
      retry: QUERY_RETRY_COUNT,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: MUTATION_RETRY_COUNT,
    },
  },
})
